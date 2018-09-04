let key
const socket = new WebSocket('ws://localhost:3004')
socket.onopen = () => console.log('Socket is open')
socket.onclose = () => console.log('Socket closed')

const sendButton = document.getElementById('sendButton');
const messageInputBox = document.getElementById('message');
const receiveBox = document.getElementById('receivebox');

let localConnection, remoteConnection, channel

sendButton.addEventListener('click', sendMessage);

if (window.location.search === '') {
  handleClient1(socket)
} else {
  key = window.location.search.split('=')[1]
  handleClient2(socket)
}

function handleClient1(socket) {
  socket.onmessage = ({ data }) => {
    const msg = JSON.parse(data)

    console.log(msg)
    switch(msg.Type) {
      case 'key':
        return console.log(window.location + "?key=" + msg.Key)
      case 'answer':
        return localConnection.setRemoteDescription(JSON.parse(msg.Data))
      case 'ice':
        return localConnection.addIceCandidate(JSON.parse(msg.Data))
    }
  }
  localConnection = new RTCPeerConnection({iceServers: [
    {urls: ['stun:stun.services.mozilla.com:3478'] },
  ]});
  channel = localConnection.createDataChannel('channel');
  channel.onopen = handleChannelStatusChange;
  channel.onclose = handleChannelStatusChange;
  channel.onmessage = handleReceiveMessage;

  localConnection.onicecandidate = e => {
    if (!e.candidate) {
      return
    }
    socket.send(JSON.stringify({
      Type: 'ice',
      Data: JSON.stringify(e.candidate),
      Key: key
    }))
  }

  localConnection.createOffer()
    .then(offer => localConnection.setLocalDescription(offer))
    .then(() => {
      const sendOffer = () => socket.send(JSON.stringify({
        Type: 'setOffer',
        Data: JSON.stringify(localConnection.localDescription)
      }))

      socket.readyState === socket.OPEN ? sendOffer() : socket.onopen = sendOffer
    })
}

function handleClient2(socket) {
  socket.onopen = () => {
    socket.send(JSON.stringify({
      Type: 'getOffer',
      Key: key
    }))
  }

  socket.onmessage = ({ data }) => {
    const msg = JSON.parse(data)

    console.log(msg)
    switch (msg.Type) {
      case 'offer':
        remoteConnection.setRemoteDescription(JSON.parse(msg.Data))
        remoteConnection.createAnswer()
          .then(answer => remoteConnection.setLocalDescription(answer))
          .then(() => {
            socket.send(JSON.stringify({
              Type: 'setAnswer',
              Data: JSON.stringify(remoteConnection.localDescription),
              Key: key
            }))
          })
        return
      case 'ice':
        return remoteConnection.addIceCandidate(JSON.parse(msg.Data))
    }
  }

  remoteConnection = new RTCPeerConnection({iceServers: [
    {url: 'stun:stun.services.mozilla.com:3478'},
  ]});
  remoteConnection.ondatachannel = channelCallback;

  remoteConnection.onicecandidate = e => {
    if (!e.candidate) {
      return
    }
    socket.send(JSON.stringify({
      Type: 'ice',
      Data: JSON.stringify(e.candidate),
      Key: key
    }))
  }
}

function sendMessage() {
  const message = messageInputBox.value;
  channel.send(message);

  messageInputBox.value = '';
  messageInputBox.focus();
}

function channelCallback(event) {
  channel = event.channel;
  channel.onmessage = handleReceiveMessage;
  channel.onopen = handleChannelStatusChange;
  channel.onclose = handleChannelStatusChange;
}

function handleReceiveMessage(event) {
  const el = document.createElement('p');
  const txtNode = document.createTextNode(event.data);

  el.appendChild(txtNode);
  receiveBox.appendChild(el);
}

function handleChannelStatusChange(event) {
  console.log('WebRTC channel status has changed to ' + channel.readyState);
}
