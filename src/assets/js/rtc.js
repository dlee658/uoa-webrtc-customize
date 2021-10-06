import h from './helpers.js';

window.addEventListener( 'load', () => {
    const room = h.getQString( location.href, 'room' );
    const username = sessionStorage.getItem( 'username' );

    if ( !room ) { //If user is not in the room yet
        document.querySelector( '#room-create' ).attributes.removeNamedItem( 'hidden' );
    }

    else if ( !username ) { //If user is not in the room yet
        document.querySelector( '#username-set' ).attributes.removeNamedItem( 'hidden' );
    }

    else {  //If user joined the room
        let commElem = document.getElementsByClassName( 'room-comm' );

        for ( let i = 0; i < commElem.length; i++ ) {
            commElem[i].attributes.removeNamedItem( 'hidden' );
        }

        var pc = [];

        let socket = io( '/stream' );

        let hostId = '';
        var socketId = '';
        var randomNumber = `__${h.generateRandomString()}__${h.generateRandomString()}__`;
        var myStream = '';
        var screen = '';
        var recordedStream = [];
        var mediaRecorder = '';
        let pcUsernames = [];
        let pcMediaStreams = [];
        let mainUserEle = '' //the hidden input in the main stream to store main user id
        

        //Get user video by default
        getAndSetUserStream();


        //signaling process
        socket.on( 'connect', () => {
            //set socketId
            socketId = socket.io.engine.id;
            document.getElementById('randomNumber').innerText = randomNumber;

//-----------------------------------------------------------------------------------
//-----------------------------------------------------------------------------------
//-----------------------------------------------------------------------------------
            socket.emit( 'subscribe', { //new joined user inform other users
                room: room,
                socketId: socketId,
                newUsername : username
            } );
            


            //setting host socket id
            socket.on('set host',(data)=>{
                
                console.log('setting host '+ data.hostName)

                hostId = data.hostId;
                pcUsernames['host'] = data.hostName;

                mainUserEle = document.getElementById('main-user-id');

                const mainVideo = document.getElementById('host').querySelector('video');
                const myPinBtn = document.getElementById('local-container').querySelector('button');
                myPinBtn.addEventListener('click',()=>{
                    h.getUserFullMedia().then( async ( stream ) => {
                        if ( mainVideo) {
                            h.setMainStream( stream ); //setMainStream function takes a media stream as a param and set it to the main video
                        }
                    } ).catch( ( e ) => {
                        console.error( e );
                    } );
                })

                if(data.hostId === socketId){ //if I am the host show my screen on the main video

                    mainUserEle.value = socketId
                    h.getUserFullMedia().then( async ( stream ) => {
                        if ( mainVideo) {
                            h.setMainStream( stream ); //setMainStream function takes a media stream as a param and set it to the main video
                        }
                    } ).catch( ( e ) => {
                        console.error( e );
                    } );
                    
                    

                }else{ 
                    console.log(pcMediaStreams[hostId])
                }

                 

            })

            socket.on('host out',()=>{
                console.log('host out');
                const mainVideo = document.getElementById('host').querySelector('video');

                h.getUserFullMedia().then( async ( stream ) => {
                    if ( mainVideo) {
                        h.setMainStream( stream ); //setMainStream function takes a media stream as a param and set it to the main video
                    }
                } ).catch( ( e ) => {
                    console.error( e );
                } );
            })

            //existing users get informed about the new user
            socket.on( 'new user', ( data ) => {
                socket.emit( 'newUserStart', { to: data.socketId, sender: socketId, oldUsername:username } ); //data.socketId = new user's socketId , sender = existent user's socketId
                pc.push( data.socketId ); //add new user's socketId
                pcUsernames[data.socketId] = data.newUsername; //setting new user's name
                                
                init( true, data.socketId ); //add stream tracks to each peer connection  //existent user init
            } );

            //response from existing users
            socket.on( 'newUserStart', ( data ) => { //new User gets a response from existing users with their socketId
                pc.push( data.sender ); //data.sender = existent user
                pcUsernames[data.sender] = data.oldUsername; //setting old user's name
                init( false, data.sender ); //new user initialize with existent user's socketId
            } );


            socket.on( 'ice candidates', async ( data ) => {
                data.candidate ? await pc[data.sender].addIceCandidate( new RTCIceCandidate( data.candidate ) ) : '';
            } );



            //set local description / remote descriptions
            socket.on( 'sdp', async ( data ) => {

                if ( data.description.type === 'offer' ) {
                    console.log('sdp offer')
                    data.description ? await pc[data.sender].setRemoteDescription( new RTCSessionDescription( data.description ) ) : '';

                    h.getUserFullMedia().then( async ( stream ) => {
                        if ( !document.getElementById( 'local' ).srcObject ) {
                            h.setLocalStream( stream );
                        }

                        //save my stream
                        myStream = stream;

                        stream.getTracks().forEach( ( track ) => {
                            pc[data.sender].addTrack( track, stream );
                        } );

                        let answer = await pc[data.sender].createAnswer();

                        await pc[data.sender].setLocalDescription( answer ); //automatically generate ice candidates

                        socket.emit( 'sdp', { description: pc[data.sender].localDescription, to: data.sender, sender: socketId } );
                    } ).catch( ( e ) => {
                        console.error( e );
                    } );
                }

                else if ( data.description.type === 'answer' ) {
                    console.log('sdp answer')
                    await pc[data.sender].setRemoteDescription( new RTCSessionDescription( data.description ) );
                }
            } );
            
            //Informed by other user that he has turned on/off the video sharing
            socket.on('videoSharing',({status,sender})=>{
                if(status==='on'){ //user turned on video sharing
                    if ( document.getElementById( `${ sender }-video` ) ) {
                        document.getElementById( `${ sender }-video` ).srcObject =pcMediaStreams[sender];
                    }

                    //If turned on user was on the main video turn it on on the main as well
                    if(mainUserEle.value === sender){
                        document.getElementById('host').querySelector('video').srcObject = pcMediaStreams[document.getElementById('main-user-id').value];
                    }


                }else if(status==='off'){ //user turned off video sharing
                    if ( document.getElementById( `${ sender }-video` ) ) {
                        pcMediaStreams[sender] = document.getElementById( `${ sender }-video` ).srcObject;
                        document.getElementById( `${ sender }-video` ).srcObject = new MediaStream(document.getElementById( `${ sender }-video` ).srcObject.getAudioTracks()); // retrieve audio tracks from the original media stream, make a new media stream and set it to the HTMLMediaElement.srcObject 
                        document.getElementById( `${ sender }-video` ).poster='image/videoImage.png';
                    }

                    //If turned off user was on the main video turn it off on the main as well
                    if(mainUserEle.value === sender){
                        document.getElementById('host').querySelector('video').srcObject = null;
                        document.getElementById('host' ).poster='image/videoImage.png'
                    }

                    
                }
            })

            socket.on( 'chat', ( data ) => {
                h.addChat( data, 'remote' );
            } );
        } );


        function getAndSetUserStream() {
            h.getUserFullMedia().then( ( stream ) => {
                //save my stream
                myStream = stream;

                h.setLocalStream( stream );
            } ).catch( ( e ) => {
                console.error( `stream error: ${ e }` );
            } );
        }


        function sendMsg( msg ) {
            let data = {
                room: room,
                msg: msg,
                sender: `${username} (${randomNumber})`
            };

            //emit chat message
            socket.emit( 'chat', data );

            //add localchat
            h.addChat( data, 'local' );
        }

        //init function gets called twice
        //when existing user call it, createOffer = true, partner = new user
        //when new user call it, createOffer = false, partner =  existing user

        // when new user init, offer = false, partner = existing user's socketId
        function init( createOffer, partnerName ) {
            pc[partnerName] = new RTCPeerConnection( h.getIceServer() ); //making peer connection

            if ( screen && screen.getTracks().length ) {
                screen.getTracks().forEach( ( track ) => {
                    pc[partnerName].addTrack( track, screen );//should trigger negotiationneeded event
                } );
            }

            else if ( myStream ) {
                myStream.getTracks().forEach( ( track ) => {
                    pc[partnerName].addTrack( track, myStream );//should trigger negotiationneeded event
                } );
            }

            else {
                h.getUserFullMedia().then( ( stream ) => {
                    //save my stream
                    myStream = stream;

                    stream.getTracks().forEach( ( track ) => {
                        pc[partnerName].addTrack( track, stream );//should trigger negotiationneeded event
                    } );

                    h.setLocalStream( stream );
                } ).catch( ( e ) => {
                    console.error( `stream error: ${ e }` );
                } );
            }

            //create offer
            if ( createOffer ) {
                pc[partnerName].onnegotiationneeded = async (e) => {
                    console.log('nego starts')
                    

                    let offer = await pc[partnerName].createOffer();

                    await pc[partnerName].setLocalDescription( offer );

                    socket.emit( 'sdp', { description: pc[partnerName].localDescription, to: partnerName, sender: socketId } );
                };
            }

            //send ice candidate to partnerNames
            pc[partnerName].onicecandidate = ( { candidate } ) => {
                socket.emit( 'ice candidates', { candidate: candidate, to: partnerName, sender: socketId } );
            };

            const shareOptionLabelOnHTMLAudio ="Audio Sharing is ON"
            const shareOptionLabelOffHTMLAudio = "Audio Sharing is OFF"
            // Audio check
            const handleCheckAudio = (e) => {
                e.preventDefault();
                const isChecked = e.target.checked;
                let shareOptionLabel = e.target.nextSibling;
                const selectedPeerConn = pc[e.target.value];
                let audioSender = selectedPeerConn.getSenders().find(sender => sender.track?.kind==='audio' || sender.dtmf !== null) // I assume audio senders have dtmf property
                if(isChecked){ //Turning on the audio share
                    shareOptionLabel.innerText = shareOptionLabelOnHTMLAudio;
                    audioSender.replaceTrack(myStream.getAudioTracks()[0]);
                }else{ //Turning off the audio share
                    shareOptionLabel.innerText = shareOptionLabelOffHTMLAudio;
                    audioSender.replaceTrack(null);

                }
                

            }

            const shareOptionLabelOnHTML ="Video Sharing is <span style='color:green'>ON<span>"
            const shareOptionLabelOffHTML = "Video Sharing is <span style='color:red'>OFF<span>"
            //this function handles peer connection stream when user click video sharing option
            const handleCheckVideo = (e)=>{
                e.preventDefault();
                let isChecked = e.target.checked;
                let shareOptionLabel = e.target.nextSibling;
                const selectedPeerConn = pc[e.target.value];
                let videoSender = selectedPeerConn.getSenders().find(sender => sender.track?.kind==='video' || sender.dtmf === null) // I assume that video senders have dtmf property
                
                

                
                
                if(isChecked){ //Turning on the video share
                    shareOptionLabel.innerHTML = shareOptionLabelOnHTML;
                    videoSender.replaceTrack(myStream.getVideoTracks()[0]);
                    socket.emit('videoSharing',{status:'on',to:e.target.value,sender:socketId,test:myStream.getVideoTracks()[0]}); 

                }else{ //Turning off the video share
                    shareOptionLabel.innerHTML = shareOptionLabelOffHTML;
                    videoSender.replaceTrack(null);
                    socket.emit('videoSharing',{status:'off',to:e.target.value,sender:socketId});

                }

            }

            //add
            pc[partnerName].ontrack = ( e ) => {

                console.log('on track')
                let str = e.streams[0];
                pcMediaStreams[partnerName] = str;
                const audioStreamOnly = new MediaStream(str.getAudioTracks());
                const videoPlaceHolderImg='image/videoImage.png';
                

                //setting the main video
                if ( document.getElementById( `host` ) ) {
                    if(partnerName === hostId){ //if connected pc is the host show it on the main video
                        document.getElementById( `host` ).querySelector('video').srcObject = e.streams[0];
                        mainUserEle.value = partnerName;
                        console.log('yes host')
                    }else{
                        console.log('no host')
                    }
                }

                if ( document.getElementById( `${ partnerName }-video` ) ) {
                    if(partnerName===hostId){ //If the partner is the host, show there screen on a card
                        document.getElementById( `${ partnerName }-video` ).srcObject = str
                    }else{ //
                        document.getElementById( `${ partnerName }-video` ).srcObject = audioStreamOnly;
                        document.getElementById( `${ partnerName }-video` ).poster = videoPlaceHolderImg;
                    }
                    
                }

                else {
                    //video elem
                    let newVid = document.createElement( 'video' );
                    newVid.id = `${ partnerName }-video`;
                    newVid.autoplay = true;
                    newVid.className = 'remote-video';
                    if(partnerName===hostId){ //If the partner is the host, show there screen on a card
                        newVid.srcObject = str
                    }else{
                        newVid.srcObject = audioStreamOnly;
                        newVid.poster = videoPlaceHolderImg;
                    }

                    let newVidDiv = document.createElement('div');

                    newVidDiv.classList.add('vid-div'); //vid-div contains video and control panel

                    //video controls elements
                    let controlDiv = document.createElement( 'div' );
                    controlDiv.className = 'remote-video-controls';
                    controlDiv.innerHTML = `<i class="fa fa-microphone text-white pr-3 mute-remote-mic" title="Mute"></i>
                        <i class="fa fa-expand text-white expand-remote-video" title="Expand"></i>`;


                    //==========================================================================================================
                    //Share Options
                    //==========================================================================================================



                    let peerNameLabel = document.createElement('label');
                    peerNameLabel.className = "user-name";
                    peerNameLabel.innerHTML = partnerName===hostId ? `${pcUsernames[partnerName]} (HOST)`: `${pcUsernames[partnerName]}`;
                    
                    let shareOptionControl = document.createElement('div');
                    let shareOptionControlAudio = document.createElement('div');

                    shareOptionControl.classList.add('share-option-control');
                    shareOptionControlAudio.classList.add('share-option-control-audio');

                    let videoShareOption = document.createElement('input');
                    videoShareOption.type="checkbox";

                    if(socketId === hostId) //if the user is host, leave the video sharing is checked intially
                        videoShareOption.checked= true;
                    else
                        videoShareOption.checked= false;
                    videoShareOption.value = partnerName;
                    videoShareOption.addEventListener('change',handleCheckVideo);

                    let audioShareOption = document.createElement('input');
                    audioShareOption.type="checkbox";
                    audioShareOption.checked= true;
                    audioShareOption.value = partnerName;
                    audioShareOption.addEventListener('change',handleCheckAudio);

                    let shareOptionLabel = document.createElement('label');
                    shareOptionLabel.innerHTML = videoShareOption.checked? shareOptionLabelOnHTML : shareOptionLabelOffHTML

                    let shareOptionLabelAudio = document.createElement('label');
                    shareOptionLabelAudio.innerText = videoShareOption.checked ? shareOptionLabelOnHTMLAudio : shareOptionLabelOffHTMLAudio


                    let setMainBtn = document.createElement('button');
                    setMainBtn.innerHTML = 'pin to main';
                    setMainBtn.addEventListener('click',(btnEvent)=>{
                        h.setMainStream(e.streams[0]);
                    })

                    shareOptionControl.appendChild(peerNameLabel);
                    shareOptionControl.appendChild(videoShareOption);
                    shareOptionControl.appendChild(shareOptionLabel)
                    

                    shareOptionControlAudio.appendChild(audioShareOption);
                    shareOptionControlAudio.appendChild(shareOptionLabelAudio)

                    //create a new div for card
                    let cardDiv = document.createElement( 'div' );
                    cardDiv.className = 'card card-sm';
                    cardDiv.id = partnerName;

                    newVidDiv.appendChild(newVid);
                    newVidDiv.appendChild(controlDiv);
                    cardDiv.appendChild(newVidDiv)
                    cardDiv.appendChild(shareOptionControl);
                    cardDiv.appendChild(shareOptionControlAudio);
                    cardDiv.appendChild(setMainBtn);


                    //==========================================================================================================


                    //put div in main-section elem
                    document.getElementById( 'videos' ).appendChild( cardDiv );

                    h.adjustVideoElemSize();
                }
            };



            pc[partnerName].onconnectionstatechange = ( d ) => {
                switch ( pc[partnerName].iceConnectionState ) {
                    case 'disconnected':
                    case 'failed':
                        h.closeVideo( partnerName );
                        break;

                    case 'closed':
                        h.closeVideo( partnerName );
                        break;
                }
            };




            pc[partnerName].onsignalingstatechange = ( d ) => {
                switch ( pc[partnerName].signalingState ) {
                    case 'closed':
                        console.log( "Signalling state is 'closed'" );
                        h.closeVideo( partnerName );
                        break;
                }
            };
        }


        //init current user's stream and set it to screen variable
        function shareScreen() {
            h.shareScreen().then( ( stream ) => {  //shareScreen returns stream current user's stream object
                h.toggleShareIcons( true );

                //disable the video toggle btns while sharing screen. This is to ensure clicking on the btn does not interfere with the screen sharing
                //It will be enabled was user stopped sharing screen
                h.toggleVideoBtnDisabled( true );

                //save my screen stream
                screen = stream;

                //share the new stream with all partners
                broadcastNewTracks( stream, 'video', false );

                const mainVideo = document.getElementById('host').querySelector('video');
                mainVideo.srcObject = screen;  //set the main video to the screen sharing

                //When the stop sharing button shown by the browser is clicked
                screen.getVideoTracks()[0].addEventListener( 'ended', () => {
                    stopSharingScreen();

                    if(socketId === hostId){ // if the user is the host get back to his cam video
                        mainVideo.srcObject = myStream;
                    }else{ // otherwise, bring the host stream back to the main video
                        mainVideo.srcObject = pcMediaStreams[hostId];
                    }
                    
                } );
            } ).catch( ( e ) => {
                console.error( e );
            } );
        }



        function stopSharingScreen() {
            //enable video toggle btn
            h.toggleVideoBtnDisabled( false );

            return new Promise( ( res, rej ) => {
                screen.getTracks().length ? screen.getTracks().forEach( track => track.stop() ) : '';

                res();
            } ).then( () => {
                h.toggleShareIcons( false );
                broadcastNewTracks( myStream, 'video' );
            } ).catch( ( e ) => {
                console.error( e );
            } );
        }



        function broadcastNewTracks( stream, type, mirrorMode = true ) {
            h.setLocalStream( stream, mirrorMode );

            let track = type == 'audio' ? stream.getAudioTracks()[0] : stream.getVideoTracks()[0];

            for ( let p in pc ) {
                let pName = pc[p];

                if ( typeof pc[pName] == 'object' ) {
                    h.replaceTrack( track, pc[pName] );
                }
            }
        }


        function toggleRecordingIcons( isRecording ) {
            let e = document.getElementById( 'record' );

            if ( isRecording ) {
                e.setAttribute( 'title', 'Stop recording' );
                e.children[0].classList.add( 'text-danger' );
                e.children[0].classList.remove( 'text-white' );
            }

            else {
                e.setAttribute( 'title', 'Record' );
                e.children[0].classList.add( 'text-white' );
                e.children[0].classList.remove( 'text-danger' );
            }
        }


        function startRecording( stream ) {
            mediaRecorder = new MediaRecorder( stream, {
                mimeType: 'video/webm;codecs=vp9'
            } );

            mediaRecorder.start( 1000 );
            toggleRecordingIcons( true );

            mediaRecorder.ondataavailable = function ( e ) {
                recordedStream.push( e.data );
            };

            mediaRecorder.onstop = function () {
                toggleRecordingIcons( false );

                h.saveRecordedStream( recordedStream, username );

                setTimeout( () => {
                    recordedStream = [];
                }, 3000 );
            };

            mediaRecorder.onerror = function ( e ) {
                console.error( e );
            };
        }


        //Chat textarea
        document.getElementById( 'chat-input' ).addEventListener( 'keypress', ( e ) => {
            if ( e.which === 13 && ( e.target.value.trim() ) ) {
                e.preventDefault();

                sendMsg( e.target.value );

                setTimeout( () => {
                    e.target.value = '';
                }, 50 );
            }
        } );


        //When the video icon is clicked
        document.getElementById( 'toggle-video' ).addEventListener( 'click', ( e ) => {
            e.preventDefault();

            let elem = document.getElementById( 'toggle-video' );

            if ( myStream.getVideoTracks()[0].enabled ) {
                e.target.classList.remove( 'fa-video' );
                e.target.classList.add( 'fa-video-slash' );
                elem.setAttribute( 'title', 'Show Video' );

                myStream.getVideoTracks()[0].enabled = false;
            }

            else {
                e.target.classList.remove( 'fa-video-slash' );
                e.target.classList.add( 'fa-video' );
                elem.setAttribute( 'title', 'Hide Video' );

                myStream.getVideoTracks()[0].enabled = true;
            }

            broadcastNewTracks( myStream, 'video' );
        } );


        //When the mute icon is clicked
        document.getElementById( 'toggle-mute' ).addEventListener( 'click', ( e ) => {
            e.preventDefault();

            let elem = document.getElementById( 'toggle-mute' );

            if ( myStream.getAudioTracks()[0].enabled ) {
                e.target.classList.remove( 'fa-microphone-alt' );
                e.target.classList.add( 'fa-microphone-alt-slash' );
                elem.setAttribute( 'title', 'Unmute' );

                myStream.getAudioTracks()[0].enabled = false;
            }

            else {
                e.target.classList.remove( 'fa-microphone-alt-slash' );
                e.target.classList.add( 'fa-microphone-alt' );
                elem.setAttribute( 'title', 'Mute' );

                myStream.getAudioTracks()[0].enabled = true;
            }

            broadcastNewTracks( myStream, 'audio' );
        } );


        //When user clicks the 'Share screen' button
        document.getElementById( 'share-screen' ).addEventListener( 'click', ( e ) => {
            e.preventDefault();

            if ( screen && screen.getVideoTracks().length && screen.getVideoTracks()[0].readyState != 'ended' ) {
                stopSharingScreen();
            }

            else {
                shareScreen();
            }
        } );


        //When record button is clicked
        document.getElementById( 'record' ).addEventListener( 'click', ( e ) => {
            /**
             * Ask user what they want to record.
             * Get the stream based on selection and start recording
             */
            if ( !mediaRecorder || mediaRecorder.state == 'inactive' ) {
                h.toggleModal( 'recording-options-modal', true );
            }

            else if ( mediaRecorder.state == 'paused' ) {
                mediaRecorder.resume();
            }

            else if ( mediaRecorder.state == 'recording' ) {
                mediaRecorder.stop();
            }
        } );


        //When user choose to record screen
        document.getElementById( 'record-screen' ).addEventListener( 'click', () => {
            h.toggleModal( 'recording-options-modal', false );

            if ( screen && screen.getVideoTracks().length ) {
                startRecording( screen );
            }

            else {
                h.shareScreen().then( ( screenStream ) => {
                    startRecording( screenStream );
                } ).catch( () => { } );
            }
        } );


        //When user choose to record own video
        document.getElementById( 'record-video' ).addEventListener( 'click', () => {
            h.toggleModal( 'recording-options-modal', false );

            if ( myStream && myStream.getTracks().length ) {
                startRecording( myStream );
            }

            else {
                h.getUserFullMedia().then( ( videoStream ) => {
                    startRecording( videoStream );
                } ).catch( () => { } );
            }
        } );
    }
} );
