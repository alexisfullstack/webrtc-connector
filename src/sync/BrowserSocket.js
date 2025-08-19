// WebSocket-like wrapper over WebRTC DataChannel (pure client, no servers).
// API: onopen, onmessage({data}), send(data), close()
// Manual signaling (copy/paste base64 SDP):
//   - Host: createOffer() -> share string; then acceptAnswer(answerB64)
//   - Guest: createAnswerFromOffer(offerB64) -> share string back
export class BrowserSocket {
  constructor() {
    this.pc = new RTCPeerConnection({ iceServers: [] }); // strictly no servers
    this.dc = null;
    this.onopen = null;
    this.onmessage = null;
    this.onclose = null;
  }

  async createOffer() {
    this.dc = this.pc.createDataChannel("room", { ordered: true });
    this._wire(this.dc);
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    await waitIceComplete(this.pc);
    
    return btoa(JSON.stringify(this.pc.localDescription));
  }

  async acceptAnswer(answerB64) {
    const answer = JSON.parse(atob(answerB64));
    await this.pc.setRemoteDescription(answer);
  }

  async createAnswerFromOffer(offerB64) {
    this.pc.ondatachannel = (ev) => {
      this.dc = ev.channel;
      this._wire(this.dc);
    };

    const offer = JSON.parse(atob(offerB64));
    await this.pc.setRemoteDescription(offer);
    
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    await waitIceComplete(this.pc);
    
    return btoa(JSON.stringify(this.pc.localDescription));
  }

  send(data) {
    const payload = typeof data === "string" ? data : JSON.stringify(data);
    this.dc?.send(payload);
  }

  close() {
    try {
      this.dc?.close();
    } catch {}
    try {
      this.pc?.close();
    } catch {}
  }

  _wire(dc) {
    dc.onopen = () => this.onopen?.();
    dc.onmessage = (e) => this.onmessage?.({ data: e.data });
    dc.onclose = () => this.onclose?.();
  }
}

function waitIceComplete(pc) {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === "complete") {
      return resolve();
    }
      
    pc.onicegatheringstatechange = () => {
      if (pc.iceGatheringState === "complete") {
        resolve();
      }
    };
  });
}
