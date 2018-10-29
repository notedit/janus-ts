import WebSocket  from 'ws'
import { EventEmitter } from 'events'
import randomstring from 'randomstring'



interface Message {
    transaction?:string
    data:any
    resolve?:any
    reject?:any
}

class Handle extends EventEmitter 
{

    private id:number
    private session:Session
    private gateway:Gateway

    constructor(id:number,session:Session,gateway:Gateway)
    {
        super()

        this.id = id
        this.session = session
        this.gateway = gateway
    }

    private sendMessage(message:Message)
    {
        message.data.handle_id = this.id
    }
    // sync request
    async request(body:any) 
    {

        return new Promise((presolve, preject) => {

            const message:Message =  {
                data: {
                    janus:'message',
                    body: body
                }
            }

            message.resolve = (data:any) => {
                if(data.janus === 'error') {
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
    async message(body:any, jsep:any)
    {
        return new Promise((presolve, preject) => {
            
            const message:Message = {
                data: {
                    janus:'message',
                    body:body
                }
            }

            message.resolve = (data:any) => {
                if (data.janus === 'error') {
                    this.gateway.clearMessage(message)
                    preject(new Error(data.error.reason))
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

    async trickle(candidate:any)
    {
        return new Promise((presolve, preject) => {

            const message:Message = {
                data: {
                    janus:'trickle',
                    candidate: candidate
                }
            }

            message.resolve = (data:any) => {
                this.gateway.clearMessage(message)
                if (data.janus === 'error') {
                    preject(new Error(data.error.reason))
                    return
                }
                presolve(data)
            }
            
            this.sendMessage(message)
        })
    }

    async detach() 
    {
        return new Promise((presolve, preject) => {

            const message:Message = {
                data: {
                    janus:'detach'
                }
            }

            message.resolve = (data:any) => {
                this.gateway.clearMessage(message)
                if (data.janus === 'error') {
                    preject(new Error(data.error.reason))
                    return
                }
                presolve(data)
            }
            
            this.sendMessage(message)
        })
    }

}



class Session extends EventEmitter 
{
    private id:number 
    private destroyed:boolean
    private gateway:Gateway 
    public handles:Map<number, Handle> 

    constructor(id:number,gateway:Gateway) 
    {
        super()
        this.id = id
        this.handles = new Map()
        this.gateway = gateway
        this.destroyed = false

    }

    async attach(plugin:string)
    {

        return new Promise((presolve, preject) => {

            const message:Message = {
                data: {
                    janus: 'attach',
                    plugin: plugin
                }
            }


            message.resolve = (data:any) => {
                this.gateway.clearMessage(message)
                if(data.janus === 'error') {
                    preject(new Error(data.error.reason))
                    return
                }
                const handleId = data.data.id 
                const handle = new Handle(handleId, this, this.gateway)
                this.handles.set(handleId,handle)
                presolve(handle)
            }

            this.sendMessage(message)

        })
        
    } 

    async keeplive() 
    {
        return new Promise((presolve, preject) => {

            const message:Message = {
                data: {
                    janus: 'keeplive'
                }
            }

            message.resolve = (data:any) => {
                this.gateway.clearMessage(message)
                presolve(data)
            }

            this.sendMessage(message)

        })
    }

    async destroy()
    {
        return new Promise((presolve, preject) => {
            
            const message:Message = {
                data: {
                    janus: 'destroy'
                }
            }


            message.resolve = (data:any) => {
                this.gateway.clearMessage(message)
                if(data.janus === 'error') {
                    preject(new Error(data.error.reason))
                    return
                }
                presolve(data)
            }

            this.sendMessage(message)
        })
    }

    sendMessage(message:Message)
    {
        message.data.session_id = this.id
        this.gateway
    }
}


class Gateway extends EventEmitter 
{

    private closed:boolean 
    private pingTimer:NodeJS.Timeout

    public sessions: Map<string, Session> 
    public websocket: WebSocket 
    public transactions: Map<string, any> 

    constructor(uri: string)
    {
        super()
        this.websocket  = new WebSocket(uri,{protocol:'janus-protocol'})
        this.sessions = new Map()
        this.transactions = new Map()
        this.closed = false

        this.websocket.on('open', async () => {
            this.emit('open')
            this.pingTimer = setInterval(() => {
                this.websocket.ping()
            }, 10000)

        })

        this.websocket.on('message', async (data:string) => {
            const msg = JSON.parse(data)
            console.dir('recv ', msg)
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
                let req = this.transactions[msg.transaction]
                if (req) {
                    req.resolve(msg)
                }
            }
        })

        this.websocket.on('close', async () => {
            this.emit('close')
            if(this.pingTimer) {
                clearInterval(this.pingTimer)
                this.pingTimer = null
            }
        })

    }

    async info()
    {

        return new Promise((presolve, preject) => {

            const message:Message = {
                data: {
                    janus: 'info'
                }
            }

            message.resolve = (data:any) => {
                this.clearMessage(message)
                if(data.janus === 'error') {
                    preject(new Error(data.error.reason))
                    return
                }
                presolve(data)
            }
            this.sendMessage(message)
        })

    }

    async create()
    {
        return new Promise((presolve:(sess:Session) => void , preject) => {

            const message:Message = {
                data: {
                    janus: 'create'
                }
            }
            
            message.resolve = (data:any) => {
                this.clearMessage(message)
                if(data.janus === 'error') {
                    preject(new Error(data.error.reason))
                    return
                }
                let sessionId = data.data.id
                let session = new Session(sessionId,this)
                this.sessions.set(sessionId,session)
                presolve(session)
            }
            this.sendMessage(message)

        })
    }

    async close() 
    {
        
        if (this.closed) {
            return
        }

        for(let session of this.sessions.values()) {
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
    clearMessage(message:Message) 
    {
        this.transactions.delete(message.transaction)
    }
    sendMessage(message:Message)
    {
        message.transaction = randomstring.generate(12)
        message.data.transaction = message.transaction

        this.transactions.set(message.transaction,message)
        this.websocket.send(JSON.stringify(message.data), (err?:Error) => {
            this.transactions.delete(message.transaction)
        })
    }

}


export default {
    Gateway,
    Session,
    Handle
}




