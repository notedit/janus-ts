



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

    let streaminfo = await handle.request({
        request: 'info',
        id: 1
    })

    console.log(streaminfo)

    // create stream  

    let created = await handle.request({
        request: 'create',
        type:'rtp',
        audio:true,
        video:true,
        audioport:10006,
        audiopt:100,
        audiortpmap:'opus/48000/2',
        videoport:10008,
        videopt:101,
        videortpmap:'VP8/90000',
        videobufferkf:true,
    })
    
    console.log(created.plugindata.data.stream)

})