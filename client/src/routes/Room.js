import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import Peer from "simple-peer";
import styled from "styled-components";

const Container = styled.div`
    padding: 20px;
    display: flex;
    height: 100vh;
    width: 90%;
    margin: auto;
    flex-wrap: wrap;
`;

const StyledVideo = styled.video`
    height: 40%;
    width: 50%;
`;

const Video = (props) => {
    const ref = useRef();

    useEffect(() => {
        props.peer.on("stream", stream => {
            ref.current.srcObject = stream;
        })
    }, []);

    return (
        <StyledVideo playsInline autoPlay ref={ref} />
    );
}


const videoConstraints = {
    height: window.innerHeight / 2,
    width: window.innerWidth / 2
};

const Room = (props) => {
    const [isAudio,setAudio]=useState(false);
    const [peers, setPeers] = useState([]);
    const socketRef = useRef();
    const userVideo = useRef();
    const peersRef = useRef([]);
    const roomID = props.match.params.roomID;

    useEffect(() => {
        window.onbeforeunload =()=>{
            if(socketRef.current){
                socketRef.current.close();
            } 
            setPeers([]);
        }
    });

    function createPeer(userToSignal, callerID, stream) {
        const peer = new Peer({
            initiator: true,
            trickle: false,
             config: {
              iceServers: [
                     {
                        urls:"stun:numb.viagenie.ca:443",
                        username:username_stun,
                        credential:passsword_stun
                    },
                    {
                        urls:"turn:numb.viagenie.ca:80",
                        username:username_stun,
                        credential:passsword_stun
                    },
                     {
                        urls:"turn:numb.viagenie.ca:443?transport=tcp",
                        username:username_stun,
                        credential:passsword_stun
                    }
                ],
            },
            stream,
        });


        peer.on("signal", signal => {
            socketRef.current.emit("sending signal", { userToSignal, callerID, signal })
        })

        return peer;
    }

    function addPeer(incomingSignal, callerID, stream) {
        const peer = new Peer({
            initiator: false,
            trickle: false,
            config: {
            iceServers: [
                     {
                        urls:"stun:numb.viagenie.ca:443",
                        username:username_stun,
                        credential:passsword_stun
                    },
                    {
                        urls:"turn:numb.viagenie.ca:80",
                        username:username_stun,
                        credential:passsword_stun
                    },
                     {
                        urls:"turn:numb.viagenie.ca:443?transport=tcp",
                        username:username_stun,
                        credential:passsword_stun
                    }
                ],
            },
            stream,
        })

        peer.on("signal", signal => {
            socketRef.current.emit("returning signal", { signal, callerID })
        })

        peer.signal(incomingSignal);

        return peer;
    }

    const wantsToJoin=()=>{
        socketRef.current = io.connect("/");
        navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: true }).then(stream => {
            userVideo.current.srcObject = stream;
            socketRef.current.emit("join room", roomID);
            socketRef.current.on("all users", users => {
                const peers = [];
                users.forEach(userID => {
                    const peer = createPeer(userID, socketRef.current.id, stream);
                    peersRef.current.push({
                        peerID: userID,
                        peer,
                    })
                    peers.push(peer);
                })
                setPeers(peers);
            })

            socketRef.current.on("user joined", payload => {
                const peer = addPeer(payload.signal, payload.callerID, stream);
                peersRef.current.push({
                    peerID: payload.callerID,
                    peer,
                })

                setPeers(users => [...users, peer]);
            });

            socketRef.current.on("receiving returned signal", payload => {
                const item = peersRef.current.find(p => p.peerID === payload.id);
                item.peer.signal(payload.signal);
            });

            socketRef.current.on("user left",id=>{
                console.log("Called...");
                const peerObj=peersRef.current.find(p=>p.peerID===id);
                if(peerObj){
                    peerObj.peer.destroy();
                }
                let remaining=[];
                peersRef.current.forEach(row=>{
                    if(row.peerID!==id){
                        remaining.push(row.peer);
                    }
                })
                const peers = peersRef.current.filter(p=>p.peerID!==id);
                peersRef.current=peers;
                setPeers(remaining);
            })

        })
    }

    const Handle=()=>{
        //Wants To Leave
        if(isAudio){
            window.location.reload();
        }
        //Wants to Join
        else{
            wantsToJoin();
            setAudio(true);
        }
    }

    return (
        <Container>
            <button onClick={Handle}>Join or Leave</button>
            <StyledVideo muted ref={userVideo} autoPlay playsInline />
            {console.log("Log : ",peers,peersRef.current)}
            {peersRef.current.map((peer, index) => {
                return (
                    <Video key={peer.peerID} peer={peer.peer} />
                );
            })}
        </Container>
    );
};

export default Room;