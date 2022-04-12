var firebaseConfig = {
  apiKey: "AIzaSyDD7tLMRu3nkqAZ1581Ww1lioSbiZYqx0w",
  authDomain: "webrtc-test-93e13.firebaseapp.com",
  databaseURL: "https://webrtc-test-93e13-default-rtdb.firebaseio.com",
  projectId: "webrtc-test-93e13",
  storageBucket: "webrtc-test-93e13.appspot.com",
  messagingSenderId: "707276360886",
  appId: "1:707276360886:web:916623f8ee93d9c2e7aa17",
  measurementId: "G-1X2VJ1D2G3",
};
function setupFirebase() {
  // Initialize Firebase
  firebase.initializeApp(firebaseConfig);
  firebase.analytics();
}
const viewers = {};
let localPeerId;
let remotePeerId;
let isOfferer;
function displayMediaTrack(tracks) {
  text = "";
  tracks.forEach((track) => {
    text += "・" + track.kind + ": " + track.label + "\n";
  });
  document.getElementById("localMediaTrack").innerText = text;
}
function displayLocalPeerId(peerId) {
  document.getElementById("localPeerId").innerText = peerId;
}
function displayRemotePeerId(peerId) {
  document.getElementById("remotePeerId").innerText = peerId;
}
function displayCandidate(candidate) {
  document.getElementById("localCandidates").innerText +=
    JSON.stringify(candidate) + "\n";
}
function displayRemoteCandidate(candidate) {
  document.getElementById("remoteCandidates").innerText +=
    JSON.stringify(candidate) + "\n";
}
function displayLocalOfferSdp(sdp) {
  document.getElementById("localOfferSdp").innerText = sdp;
}
function displayLocalAnswerSdp(sdp) {
  document.getElementById("localAnswerSdp").innerText = sdp;
}
function displayRemoteOfferSdp(sdp) {
  document.getElementById("remoteOfferSdp").innerText = sdp;
}
function displayRemoteAnswerSdp(sdp) {
  document.getElementById("remoteAnswerSdp").innerText = sdp;
}
function onDisconnectFirebase(usersRef, localPeerId) {
  usersRef
    .child(localPeerId + "/status")
    .onDisconnect()
    .set("offline");
}

(async function () {
  setupFirebase();

  // カメラ映像取得
  const localMediaStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: false,
  });

  // console.log(RTCRtpSender.getCapabilities("video").codecs);
  displayMediaTrack(localMediaStream.getTracks());
  const localVideo = document.getElementById("localVideo");
  localVideo.srcObject = localMediaStream;
  const config = {
    iceServers: [
      {
        urls: "stun:stun.l.google.com:19302",
      },
    ],
    iceTransportPolicy: "all", // all or relay
    bundlePolicy: "max-compat",
  };
  const localPeer = new RTCPeerConnection(config);
  // まだ誰も入室していない場合にはOfferを作成する。
  // 既に入室している場合にはAnswerを作成する
  const usersRef = firebase.database().ref("users/");
  // online状態になっているpeerのなから最初の一つだけ取り出す。
  usersRef
    .orderByChild("status")
    .equalTo("online")
    .once("value")
    .then(async function (snapshot) {
      if (!snapshot.val()) {
        isOfferer = true;
        const offerSdp = await localPeer.createOffer();
        displayLocalOfferSdp(offerSdp.sdp);
        await localPeer.setLocalDescription(offerSdp);
        localPeerId = usersRef.push({
          offerSdp: JSON.stringify(offerSdp),
          created: Date.now(),
          status: "online",
        }).key;
        onDisconnectFirebase(usersRef, localPeerId);
        displayLocalPeerId(localPeerId);
        usersRef
          .child(localPeerId + "/remotePeerId")
          .on("value", async (snapshot) => {
            remotePeerId = snapshot.val();
            if (!remotePeerId) {
              return;
            }
            displayRemotePeerId(remotePeerId);
            usersRef.child(remotePeerId).once("value", async (snapshot) => {
              remotePeer = snapshot.val();
              const remoteAnswerSdp = new RTCSessionDescription(
                JSON.parse(remotePeer.answerSdp)
              );
              displayRemoteAnswerSdp(remoteAnswerSdp.sdp);
              await localPeer.setRemoteDescription(remoteAnswerSdp);
              const remotePeerCandidates = firebase
                .database()
                .ref("users/" + remotePeerId + "/candidates");
              remotePeerCandidates.on("child_added", (snapshot, _) => {
                displayRemoteCandidate(JSON.parse(snapshot.val()));
                localPeer.addIceCandidate(JSON.parse(snapshot.val()));
              });
            });
          });
      } else {
        if (Object.keys(snapshot.val()).length >= 2) {
          window.alert("もう既に2人以上入室しています");
          return;
        }
        remotePeerId = Object.keys(snapshot.val())[0];
        const remotePeer = snapshot.val()[remotePeerId];
        displayRemotePeerId(remotePeerId);
        const remoteOfferSdp = new RTCSessionDescription(
          JSON.parse(remotePeer.offerSdp)
        );
        displayRemoteOfferSdp(remoteOfferSdp.sdp);
        await localPeer.setRemoteDescription(remoteOfferSdp);
        const answerSdp = await localPeer.createAnswer();
        // answerSdp.sdp = answerSdp.sdp.replace(
        //   /a=mid:(.*)\r\n/g,
        //   "a=mid:$1\r\nb=AS:" + 50 + "\r\n"
        // );
        displayLocalAnswerSdp(answerSdp.sdp);
        await localPeer.setLocalDescription(answerSdp);
        localPeerId = usersRef.push({
          answerSdp: JSON.stringify(answerSdp),
          created: Date.now(),
          remotePeerId: remotePeerId,
          status: "online",
        }).key;
        onDisconnectFirebase(usersRef, localPeerId);
        usersRef.child(remotePeerId + "/remotePeerId").set(localPeerId);

        const remotePeerCandidates = firebase
          .database()
          .ref("users/" + remotePeerId + "/candidates");
        remotePeerCandidates.on("child_added", (snapshot, _) => {
          displayRemoteCandidate(JSON.parse(snapshot.val()));
          localPeer.addIceCandidate(JSON.parse(snapshot.val()));
        });
      }
    });
  localPeer.onicecandidate = (e) => {
    if (e.candidate) {
      displayCandidate(e.candidate);
      console.log(e.candidate);
      console.log(JSON.stringify(e.candidate));
      usersRef
        .child(localPeerId + "/candidates")
        .push(JSON.stringify(e.candidate));
    }
  };
  localPeer.onicegatheringstatechange = function () {
    document.getElementById("localPeerIceGatheringState").innerText +=
      "=>" + localPeer.iceGatheringState;
  };
  localMediaStream.getTracks().forEach((track) => {
    localPeer.addTrack(track, localMediaStream);
  });

  localPeer.addEventListener("track", (e) => {
    document.getElementById("remoteVideo").srcObject = e.streams[0];
  });
})();
