



import janus from '../lib/janus'

const url =  'ws://localhost:8188'

const gateway = new janus.Gateway(url)

gateway.on('open', async () => {

    let info  = await gateway.info()
    console.log('info=====', info)

    let session = await gateway.create()
    
    console.dir(session)

    let handle = await session.attach('janus.plugin.streaming')

    console.dir(handle)

    let streams = await handle.request({
        request: 'list'
    })

    console.log(streams)
})