import WebSocket  from 'ws'
import { EventEmitter } from 'events'
import randomstring from 'randomstring'


class Handle extends EventEmitter 
{

    private id:number
    private session:Session

    constructor(id:number, session:Session)
    {
        super()
        
        this.id = id
        this.session = session

    }

    // sync request
    async request(body:any) 
    {

    } 
    
    // async request 
    async message(body:any, jsep:any)
    {

    }

    async trickle(candidate:any)
    {

    }

    async detach() 
    {

    }

}



class Session extends EventEmitter 
{
    private id:number 
    private handles:Map<number, Handle> 
    private gateway:Gateway 
    private destroyed:boolean

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

    } 

    async keeplive() 
    {

    }

    async destroy()
    {
        if (this.destroyed)
            return

        this.destroyed = true

        this.emit('destroyed')
    }
}




class Gateway extends EventEmitter 
{

    private sessions: Map<string, Session> 
    private websocket: WebSocket 
    private transactions: Map<string, any> 
    private closed:boolean 

    constructor(uri: string)
    {
        super()

        this.websocket  = new WebSocket(uri,{protocol:'janus-protocol'})
        this.sessions = new Map()
        this.transactions = new Map()
        this.closed = false

        this.websocket.on('open', async () => {

            this.emit('open')
        })

        this.websocket.on('message', async (data:string) => {

            const msg = JSON.parse(data)

            
        })

        this.websocket.on('close', async () => {

            this.emit('close')
        })

    }

    async info(): Promise<any>
    {

        return new Promise((presolve, preject) => {

            const req:any = {
                data : {
                    janus: 'info',
                    transaction: randomstring.generate(12),
                }
            }

            req.resolve = (data:any) => {
                this.transactions.delete(req.data.transaction)

                presolve(data)
            }

            req.reject = (err:Error) => {
                this.transactions.delete(req.data.transaction)

                preject(err)
            }
            
            this.transactions.set(req.data.transaction, req)

            this.websocket.send(JSON.stringify(req.data), (err?:Error) => {

                if(err) {
                    this.transactions.delete(req.data.transaction)
                }
            })
    
        })

    }

    async create(): Promise<any>
    {
        return new Promise((presolve, preject) => {

            const req:any = {
                data:{
                    janus:'create',
                    transaction: randomstring.generate(12)
                }
            }

            req.resove = (data:any) => {

                this.transactions.delete(req.data.transaction)
                
                let sessionId = data.data.id
                let session = new Session(sessionId,this)
                this.sessions.set(sessionId,session)
                presolve(session)
            }

            req.reject = (err:Error) => {

                this.transactions.delete(req.data.transaction)
                preject(err)
            }

            this.transactions.set(req.data.transaction, req)
        })
    }

    close() {

    }

}




