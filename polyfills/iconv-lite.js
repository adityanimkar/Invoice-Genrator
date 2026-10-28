class TextDecoderWrapper {
  constructor(encoding) {
    this.decoder = new TextDecoder(encoding || 'utf-8', { fatal: false });
  }
  write(chunk) {
    return this.decoder.decode(chunk, { stream: true });
  }
  end() {
    return this.decoder.decode();
  }
}

module.exports = {
  getDecoder: function(encoding) {
    return new TextDecoderWrapper(encoding);
  },
  encodingExists: function(encoding) {
    try {
      new TextDecoder(encoding);
      return true;
    } catch (e) {
      return false;
    }
  }
};
