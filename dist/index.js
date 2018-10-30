"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = __importDefault(require("ws"));
const events_1 = require("events");
const randomstring_1 = __importDefault(require("randomstring"));
class Handle extends events_1.EventEmitter {
    constructor(id, session, gateway) {
        super();
        this.id = id;
        this.session = session;
        this.gateway = gateway;
    }
    sendMessage(message) {
        message.data.handle_id = this.id;
        this.session.sendMessage(message);
    }
    // sync request
    request(body) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((presolve, preject) => {
                const message = {
                    data: {
                        janus: 'message',
                        body: body
                    }
                };
                message.resolve = (data) => {
                    if (data.janus === 'error') {
                        this.gateway.clearMessage(message);
                        preject(new Error(data.error.reason));
                        return;
                    }
                    this.gateway.clearMessage(message);
                    presolve(data);
                };
                this.sendMessage(message);
            });
        });
    }
    // async request 
    message(body, jsep) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((presolve, preject) => {
                const message = {
                    data: {
                        janus: 'message',
                        body: body
                    }
                };
                if (jsep) {
                    message.data.jsep = jsep;
                }
                message.resolve = (data) => {
                    if (data.janus === 'error') {
                        this.gateway.clearMessage(message);
                        preject(data.error.reason);
                        return;
                    }
                    if (data.janus === 'ack') {
                        // it is a ack,  we need await
                        return;
                    }
                    this.gateway.clearMessage(message);
                    presolve(data);
                };
                this.sendMessage(message);
            });
        });
    }
    trickle(candidate) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((presolve, preject) => {
                const message = {
                    data: {
                        janus: 'trickle',
                        candidate: candidate
                    }
                };
                message.resolve = (data) => {
                    this.gateway.clearMessage(message);
                    if (data.janus === 'error') {
                        preject(data.error.reason);
                        return;
                    }
                    presolve(data);
                };
                this.sendMessage(message);
            });
        });
    }
    detach() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((presolve, preject) => {
                const message = {
                    data: {
                        janus: 'detach'
                    }
                };
                message.resolve = (data) => {
                    this.gateway.clearMessage(message);
                    if (data.janus === 'error') {
                        preject(data.error.reason);
                        return;
                    }
                    presolve(data);
                };
                this.sendMessage(message);
            });
        });
    }
}
class Session extends events_1.EventEmitter {
    constructor(id, gateway) {
        super();
        this.id = id;
        this.handles = new Map();
        this.gateway = gateway;
        this.destroyed = false;
        this.keepliveTimer = setInterval(() => __awaiter(this, void 0, void 0, function* () {
            this.keeplive();
        }), 10000);
    }
    attach(plugin) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((presolve, preject) => {
                const message = {
                    data: {
                        janus: 'attach',
                        plugin: plugin
                    }
                };
                message.resolve = (data) => {
                    this.gateway.clearMessage(message);
                    if (data.janus === 'error') {
                        preject(data.error.reason);
                        return;
                    }
                    const handleId = data.data.id;
                    const handle = new Handle(handleId, this, this.gateway);
                    this.handles.set(handleId, handle);
                    presolve(handle);
                };
                this.sendMessage(message);
            });
        });
    }
    keeplive() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((presolve, preject) => {
                const message = {
                    data: {
                        janus: 'keeplive'
                    }
                };
                message.resolve = (data) => {
                    this.gateway.clearMessage(message);
                    presolve(data);
                };
                this.sendMessage(message);
            });
        });
    }
    destroy() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.keepliveTimer) {
                clearInterval(this.keepliveTimer);
                this.keepliveTimer = null;
            }
            if (this.destroyed) {
                return;
            }
            for (let handle of this.handles.values()) {
                yield handle.detach();
            }
            this.handles.clear();
            return new Promise((presolve, preject) => {
                const message = {
                    data: {
                        janus: 'destroy'
                    }
                };
                message.resolve = (data) => {
                    this.gateway.clearMessage(message);
                    if (data.janus === 'error') {
                        preject(data.error.reason);
                        return;
                    }
                    this.destroyed = true;
                    this.emit('destroyed');
                    presolve(data);
                };
                this.sendMessage(message);
            });
        });
    }
    sendMessage(message) {
        message.data.session_id = this.id;
        this.gateway.sendMessage(message);
    }
}
class Gateway extends events_1.EventEmitter {
    constructor(uri) {
        super();
        this.websocket = new ws_1.default(uri, 'janus-protocol');
        this.sessions = new Map();
        this.transactions = new Map();
        this.closed = false;
        this.websocket.on('open', () => __awaiter(this, void 0, void 0, function* () {
            this.emit('open');
            this.pingTimer = setInterval(() => {
                this.websocket.ping();
            }, 5000);
        }));
        this.websocket.on('message', (data) => __awaiter(this, void 0, void 0, function* () {
            let msg;
            try {
                msg = JSON.parse(data);
            }
            catch (error) {
                console.error('json parse error', error);
                return;
            }
            if (!msg.transaction) {
                if (msg.sender) {
                    if (msg.session_id && this.sessions.get(msg.session_id)) {
                        let session = this.sessions.get(msg.session_id);
                        let handle = session.handles.get(msg.sender);
                        if (!handle) {
                            return;
                        }
                        handle.emit('event', msg);
                    }
                    else {
                        console.error('can not find sessionid', msg);
                    }
                }
                else {
                    console.error(msg);
                }
            }
            else {
                let req = this.transactions.get(msg.transaction);
                if (req) {
                    req.resolve(msg);
                }
            }
        }));
        this.websocket.on('close', () => __awaiter(this, void 0, void 0, function* () {
            this.emit('close');
            if (this.pingTimer) {
                clearInterval(this.pingTimer);
                this.pingTimer = null;
            }
        }));
    }
    info() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((presolve, preject) => {
                const message = {
                    data: {
                        janus: 'info'
                    }
                };
                message.resolve = (data) => {
                    this.clearMessage(message);
                    if (data.janus === 'error') {
                        preject(data.error.reason);
                        return;
                    }
                    presolve(data);
                };
                this.sendMessage(message);
            });
        });
    }
    create() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((presolve, preject) => {
                const message = {
                    data: {
                        janus: 'create'
                    }
                };
                message.resolve = (data) => {
                    this.clearMessage(message);
                    if (data.janus === 'error') {
                        preject(data.error.reason);
                        return;
                    }
                    let sessionId = data.data.id;
                    let session = new Session(sessionId, this);
                    this.sessions.set(sessionId, session);
                    presolve(session);
                };
                this.sendMessage(message);
            });
        });
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.closed) {
                return;
            }
            for (let session of this.sessions.values()) {
                yield session.destroy();
            }
            this.transactions.clear();
            if (this.websocket) {
                this.websocket.close();
            }
            if (this.pingTimer) {
                clearInterval(this.pingTimer);
                this.pingTimer = null;
            }
            this.closed = true;
            this.emit('closed');
        });
    }
    clearMessage(message) {
        this.transactions.delete(message.transaction);
    }
    sendMessage(message) {
        message.transaction = randomstring_1.default.generate(12);
        message.data.transaction = message.transaction;
        this.transactions.set(message.data.transaction, message);
        this.websocket.send(JSON.stringify(message.data), (err) => {
            if (err) {
                this.transactions.delete(message.transaction);
            }
        });
    }
}
exports.default = {
    Gateway,
    Session,
    Handle
};
