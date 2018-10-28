import WebSocket  from 'ws'
import { EventEmitter } from 'events'


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

    constructor(id:number,gateway:Gateway) 
    {
        super()
        this.id = id
        this.handles = new Map()
        this.gateway = gateway

    }

    async attach(plugin:string)
    {

    } 

    async keeplive() 
    {

    }

    async destroy()
    {

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

        })

        this.websocket.on('message', async (data:string) => {

        })

        this.websocket.on('close', async () => {

        })

    }

    info() 
    {

    }

    create() 
    {

    }

    close() {

    }

}




