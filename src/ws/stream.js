let roomInfos = [];

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

    socket.on('videoSharing', ({status,sender,to})=>{
        socket.to(to).emit('videoSharing',{status,sender});
    })


    socket.on( 'chat', ( data ) => {
        socket.to( data.room ).emit( 'chat', { sender: data.sender, msg: data.msg } );
    } );
};

module.exports = stream;
