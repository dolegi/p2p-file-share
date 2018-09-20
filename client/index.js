import SparkMD5 from 'spark-md5'

let key
const socket = new WebSocket('ws://' + window.location.hostname + ':3004')
socket.onopen = () => console.log('Socket is open')
socket.onclose = () => console.log('Socket closed')

const receiveBox = document.getElementById('receivebox')

let localConnection, remoteConnection, channel
let receivedName, receivedType, receivedFile, receivedHash

if (window.location.pathname === '/') {
  handleClient1(socket)
} else {
  key = window.location.pathname.slice(1)
  handleClient2(socket)
}

function handleClient1(socket) {
  socket.onmessage = ({ data }) => {
    const msg = JSON.parse(data)

    console.log(msg)
    switch(msg.Type) {
      case 'key':
        return console.log(window.location + msg.Key)
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
    {urls: ['stun:stun.services.mozilla.com:3478' ]},
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

function channelCallback(event) {
  channel = event.channel;
  channel.onmessage = handleReceiveMessage;
  channel.onopen = handleChannelStatusChange;
  channel.onclose = handleChannelStatusChange;
}

function handleChannelStatusChange(event) {
  console.log('WebRTC channel status has changed to ' + channel.readyState);
}
document.querySelector('.file-reader').addEventListener('change', ({ target }) => target.files[0] && sendFile(target.files[0]))

function sendFile(file) {
  const chunkSize = 1024
  const fileReader = new FileReader()
  const spark = new SparkMD5()
  const readSlice = () => fileReader.readAsArrayBuffer(file.slice(offset, offset + chunkSize))

  let offset = 0

  fileReader.addEventListener('error', error => console.error('Error reading file:', error));
  fileReader.addEventListener('load', event => {
    const { result } = event.target
    spark.append(result)
    channel.send(result)
    offset += result.byteLength
    if (offset < file.size) {
      readSlice()
    } else {
      const hash = spark.end()
      channel.send(JSON.stringify({ type: 'end', data: { hash }}))
    }
  })

  channel.send(JSON.stringify({ type: 'start', data: { name: file.name, type: file.type }}))
  readSlice()
}

function handleReceiveMessage({ data }) {
  if (typeof data !== 'string') {
    return receiveChunk(data)
  }
  const { type, data: msgData } = JSON.parse(data)

  switch (type) {
    case 'start':
      return receiveStart(msgData)
    case 'end':
      return receiveEnd(msgData)
  }
}

function receiveChunk(chunk) {
  receivedHash.append(chunk)
  receivedFile.push(chunk)
}

function receiveStart({ name, type }) {
  receivedFile = []
  receivedName = name
  receivedType = type
  receivedHash = new SparkMD5()
}

function receiveEnd({ hash }) {
  if (receivedHash.end() !== hash) {
    console.log('Mismatched md5 hashes, corrupted file')
    return
  }
  const file = new Blob([receivedFile], {type: receivedType})
  const a = document.createElement('a'), url = URL.createObjectURL(file)
  a.href = url
  a.download = receivedName
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }, 0)
}


