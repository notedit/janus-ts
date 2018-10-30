import WebSocket from 'ws'
import { EventEmitter } from 'events'
import randomstring from 'randomstring'


interface Message {
    transaction?: string
    data: any
    resolve?: any
    reject?: any
}

class Handle extends EventEmitter {

    private id: number
    private session: Session
    private gateway: Gateway

    constructor(id: number, session: Session, gateway: Gateway) {
        super()

        this.id = id
        this.session = session
        this.gateway = gateway
    }

    private sendMessage(message: Message) {
        message.data.handle_id = this.id
        this.session.sendMessage(message)
    }
    // sync request
    async request(body: any) {

        return new Promise((presolve:(data:any) => void, preject) => {

            const message: Message = {
                data: {
                    janus: 'message',
                    body: body
                }
            }

            message.resolve = (data: any) => {
                if (data.janus === 'error') {
                    this.gateway.clearMessage(message)
                    preject(new Error(data.error.reason))
                    return
                }
                this.gateway.clearMessage(message)
                presolve(data)
            }

            this.sendMessage(message)
        })

    }

    // async request 
    async message(body: any, jsep: any) {
        return new Promise((presolve: (data: any) => void, preject) => {

            const message: Message = {
                data: {
                    janus: 'message',
                    body: body
                }
            }

            if (jsep) {
                message.data.jsep = jsep
            }

            message.resolve = (data: any) => {
                if (data.janus === 'error') {
                    this.gateway.clearMessage(message)
                    preject(data.error.reason)
                    return
                }
                if (data.janus === 'ack') {
                    // it is a ack,  we need await
                    return
                }
                this.gateway.clearMessage(message)
                presolve(data)
            }

            this.sendMessage(message)
        })
    }

    async trickle(candidate: any) {
        return new Promise((presolve, preject) => {

            const message: Message = {
                data: {
                    janus: 'trickle',
                    candidate: candidate
                }
            }

            message.resolve = (data: any) => {
                this.gateway.clearMessage(message)
                if (data.janus === 'error') {
                    preject(data.error.reason)
                    return
                }
                presolve(data)
            }

            this.sendMessage(message)
        })
    }

    async detach() {
        return new Promise((presolve, preject) => {

            const message: Message = {
                data: {
                    janus: 'detach'
                }
            }

            message.resolve = (data: any) => {
                this.gateway.clearMessage(message)
                if (data.janus === 'error') {
                    preject(data.error.reason)
                    return
                }
                presolve(data)
            }

            this.sendMessage(message)
        })
    }
}


class Session extends EventEmitter {
    private id: number
    private destroyed: boolean
    private gateway: Gateway
    private keepliveTimer: NodeJS.Timeout
    public handles: Map<number, Handle>

    constructor(id: number, gateway: Gateway) {
        super()
        this.id = id
        this.handles = new Map()
        this.gateway = gateway
        this.destroyed = false

        this.keepliveTimer = setInterval(async () => {
            this.keeplive()
        },10000)
    }

    async attach(plugin: string) {

        return new Promise((presolve: (handle: Handle) => void, preject) => {

            const message: Message = {
                data: {
                    janus: 'attach',
                    plugin: plugin
                }
            }

            message.resolve = (data: any) => {
                this.gateway.clearMessage(message)
                if (data.janus === 'error') {
                    preject(data.error.reason)
                    return
                }
                const handleId = data.data.id
                const handle = new Handle(handleId, this, this.gateway)
                this.handles.set(handleId, handle)
                presolve(handle)
            }

            this.sendMessage(message)

        })
    }

    async keeplive() {

        return new Promise((presolve, preject) => {

            const message: Message = {
                data: {
                    janus: 'keeplive'
                }
            }

            message.resolve = (data: any) => {
                this.gateway.clearMessage(message)
                presolve(data)
            }

            this.sendMessage(message)
        })
    }

    async destroy() {

        if (this.keepliveTimer) {
            clearInterval(this.keepliveTimer)
            this.keepliveTimer = null
        }

        if (this.destroyed) {
            return
        }

        for (let handle of this.handles.values()) {
            await handle.detach()
        }

        this.handles.clear()

        return new Promise((presolve, preject) => {

            const message: Message = {
                data: {
                    janus: 'destroy'
                }
            }

            message.resolve = (data: any) => {
                this.gateway.clearMessage(message)
                if (data.janus === 'error') {
                    preject(data.error.reason)
                    return
                }
                this.destroyed = true
                this.emit('destroyed')
                presolve(data)
            }
            
            this.sendMessage(message)
        })
    }

    sendMessage(message: Message) {
        message.data.session_id = this.id
        this.gateway.sendMessage(message)
    }
}


class Gateway extends EventEmitter {

    private closed: boolean
    private pingTimer: NodeJS.Timeout

    public sessions: Map<string, Session>
    public websocket: WebSocket
    public transactions: Map<string, any>

    constructor(uri: string) {
        super()
        this.websocket = new WebSocket(uri, 'janus-protocol')
        this.sessions = new Map()
        this.transactions = new Map()
        this.closed = false

        this.websocket.on('open', async () => {
            this.emit('open')
            this.pingTimer = setInterval(() => {
                this.websocket.ping()
            }, 1000)

        })

        this.websocket.on('message', async (data: any) => {
            let msg: any
            try {
                msg = JSON.parse(data)
            } catch (error) {
                console.error('json parse error', error)
                return
            }

            if (!msg.transaction) {
                if (msg.sender) {
                    if (msg.session_id && this.sessions.get(msg.session_id)) {
                        let session = this.sessions.get(msg.session_id)
                        let handle = session.handles.get(msg.sender)
                        if (!handle) {
                            return
                        }
                        handle.emit('event', msg)
                    } else {
                        console.error('can not find sessionid', msg)
                    }
                } else {
                    console.error(msg)
                }
            } else {

                let req = this.transactions.get(msg.transaction)
                if (req) {
                    req.resolve(msg)
                }
            }
        })

        this.websocket.on('close', async () => {
            this.emit('close')
            if (this.pingTimer) {
                clearInterval(this.pingTimer)
                this.pingTimer = null
            }
        })

    }

    async info() {

        return new Promise((presolve: (info: any) => void, preject) => {

            const message: Message = {
                data: {
                    janus: 'info'
                }
            }

            message.resolve = (data: any) => {
                this.clearMessage(message)
                if (data.janus === 'error') {
                    preject(data.error.reason)
                    return
                }
                presolve(data)
            }
            this.sendMessage(message)
        })

    }

    async create() {
        return new Promise((presolve: (sess: Session) => void, preject) => {

            const message: Message = {
                data: {
                    janus: 'create'
                }
            }

            message.resolve = (data: any) => {
                this.clearMessage(message)
                if (data.janus === 'error') {
                    preject(data.error.reason)
                    return
                }
                let sessionId = data.data.id
                let session = new Session(sessionId, this)
                this.sessions.set(sessionId, session)
                presolve(session)
            }
            this.sendMessage(message)

        })
    }

    async close() {

        if (this.closed) {
            return
        }

        for (let session of this.sessions.values()) {
            await session.destroy()
        }

        this.transactions.clear()

        if (this.websocket) {
            this.websocket.close()
        }

        if (this.pingTimer) {
            clearInterval(this.pingTimer)
            this.pingTimer = null
        }

        this.closed = true

        this.emit('closed')

    }
    clearMessage(message: Message) {
        this.transactions.delete(message.transaction)
    }
    sendMessage(message: Message) {
        message.transaction = randomstring.generate(12)
        message.data.transaction = message.transaction

        this.transactions.set(message.data.transaction, message)

        this.websocket.send(JSON.stringify(message.data), (err?: Error) => {
            if (err) {
                this.transactions.delete(message.transaction)
            }
        })
    }
}

export default {
    Gateway,
    Session,
    Handle
}