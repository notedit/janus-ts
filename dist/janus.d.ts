/// <reference types="node" />
import WebSocket from 'ws';
import { EventEmitter } from 'events';
interface Message {
    transaction?: string;
    data: any;
    resolve?: any;
    reject?: any;
}
declare class Handle extends EventEmitter {
    private id;
    private session;
    private gateway;
    constructor(id: number, session: Session, gateway: Gateway);
    private sendMessage;
    request(body: any): Promise<any>;
    message(body: any, jsep: any): Promise<any>;
    trickle(candidate: any): Promise<{}>;
    detach(): Promise<{}>;
}
declare class Session extends EventEmitter {
    private id;
    private destroyed;
    private gateway;
    handles: Map<number, Handle>;
    constructor(id: number, gateway: Gateway);
    attach(plugin: string): Promise<Handle>;
    keeplive(): Promise<{}>;
    destroy(): Promise<{}>;
    sendMessage(message: Message): void;
}
declare class Gateway extends EventEmitter {
    private closed;
    private pingTimer;
    sessions: Map<string, Session>;
    websocket: WebSocket;
    transactions: Map<string, any>;
    constructor(uri: string);
    info(): Promise<any>;
    create(): Promise<Session>;
    close(): Promise<void>;
    clearMessage(message: Message): void;
    sendMessage(message: Message): void;
}
declare const _default: {
    Gateway: typeof Gateway;
    Session: typeof Session;
    Handle: typeof Handle;
};
export default _default;
