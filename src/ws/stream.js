let roomInfos = [];

let userData = {};

const fs = require('fs');


const stream = ( socket ) => {



    socket.on( 'subscribe', ( data ) => {
        
        
        
        if(!roomInfos[data.room]){ //The first user's socket id is stored as the first host socket id
            roomInfos[data.room]= {hostId:data.socketId,hostName:data.newUsername}   
        }
        socket.emit('set host',roomInfos[data.room])
        console.log('host id = '+roomInfos[data.room].hostId)
        console.log('host name = '+roomInfos[data.room].hostName)

        //subscribe/join a room
        socket.join( data.room );
        socket.join( data.socketId );

        //Inform other members in the room of new user's arrival
        if ( socket.adapter.rooms[data.room].length > 1 ) {
            socket.to( data.room ).emit( 'new user', { socketId: data.socketId, newUsername:data.newUsername } );  //socketId = New user's socketId
        }


        socket.timer = []; // for tracking camera on

        
        
    } );

    socket.on('disconneting' , ()=>{
        for(let room in socket.rooms){
            if(socket.id === roomInfos[room].hostId){
                socket.to(room).emit('host out');
                roomInfos[room].hostId =null;
            }
        }
    })

    socket.on('disconnect',()=>{
        for(let room in socket.rooms){
            if(socket.id === roomInfos[room].hostId){
                socket.to(room).emit('host out');
                roomInfos[room].hostId =null;
            }
        }

    })



    socket.on( 'newUserStart', ( data ) => {
        socket.to( data.to ).emit( 'newUserStart', { sender: data.sender,oldUsername:data.oldUsername } );  //data.to = new user's socketId,  sender = existent user
    } );

    socket.on( 'sdp', ( data ) => {
        socket.to( data.to ).emit( 'sdp', { description: data.description, sender: data.sender } );
    } );


    socket.on( 'ice candidates', ( data ) => {
        socket.to( data.to ).emit( 'ice candidates', { candidate: data.candidate, sender: data.sender } );
    } );

    socket.on('videoSharing', ({status,sender,to,room})=>{
        socket.to(to).emit('videoSharing',{status,sender})

        
        


        if(sender !== roomInfos[room].hostId){ // We do not count host's interaction

            if(status === 'on'){
                socket.timer[to] = {...socket.timer[to],start:Date.now()}

                if(!socket.timer[to].duration){ //if this was the first connection, init duration 0
                    socket.timer[to].duration = 0;
                }
            
            }else if(status ==='off'){
                socket.timer[to] = {...socket.timer[to],end:Date.now()}

                let startTime = socket.timer[to].start;
                let endTime = socket.timer[to].end;

                // duration of the cam was open in secs
                let delta = (endTime - startTime)/1000;

                socket.timer[to].duration += delta
            }

        }
        
    })


    socket.on('submit data',(data)=>{
        for(let s in socket.timer){

            if(socket.timer[s].start> socket.timer[s].end || !socket.timer[s].end){ //if the user has not turned off cam when they submit, record the present time
                socket.timer[s].end = Date.now();
                socket.timer[s].duration += (socket.timer[s].end - socket.timer[s].start)/1000;;
            }
        }


        userData[data.username] = socket.timer;
        
        
    })
    
    socket.on('host submit data',({room})=>{
        for(user in userData){
            console.log(`User ${user} turn on cam to : `)

            fs.appendFileSync('analytics.txt',`User ${user} turn on cam to : \n`)
            
            for(peer in userData[user]){
                let pcs = userData[user];
                
                console.log(`${peer===roomInfos[room].hostId ? 'Host' : peer} for ${pcs[peer].duration}`)

                fs.appendFileSync('analytics.txt',`${peer===roomInfos[room].hostId ? 'Host' : peer} for ${pcs[peer].duration} \n`)

                
            }
        }
    })




    socket.on( 'chat', ( data ) => {
        socket.to( data.room ).emit( 'chat', { sender: data.sender, msg: data.msg } );
    } );
};

module.exports = stream;
