const fs = require('fs');

const fontParser = require('./util.fontParser.js');
const CooldownProvider = require('./util.cooldown.js');
const { color: { linearRGB } } = OMEGGA_UTIL;

// load in saves in font_fontname.brs format
const fonts = Object.fromEntries(fs.readdirSync(__dirname + '/fonts')
  .map(f => f.match(/font_([a-z0-9_]+)\.brs/))
  .filter(f => f)
  .map(match => {
    try {
      return [match[1], fontParser(__dirname + '/fonts/' + match[0])];
    } catch (err) {
      console.error('Error parsing font', match[1], ':', err);
    }
  })
  .filter(v => v));

const cooldown = CooldownProvider(1000);
const textColors = {};
const textFonts = {};

module.exports = class TextGen {
  constructor(omegga) {
    this.omegga = omegga;
  }


  init() {
    this.omegga
      // render text
      .on('chatcmd:text', (name, ...msg) => cooldown(name) && this.cmdText(name, msg.join(' '), false))
      // render centered text
      .on('chatcmd:text:center', (name, ...msg) => cooldown(name) && this.cmdText(name, msg.join(' '), true))
      // change text color
      .on('chatcmd:text:color', (name, color) => {
        if (cooldown(name) && color.match(/^[0-9A-F]{6}$/i)) {
          textColors[name] = linearRGB([parseInt(color.slice(0, 2), 16), parseInt(color.slice(2, 4), 16), parseInt(color.slice(4, 6), 16)]);
          this.omegga.broadcast(`"Setting <b>${name}</> color to #<color=\\"${color}\\">${color.toUpperCase()}</>"`);
        }
      })
      // change text font
      .on('chatcmd:text:font', (name, font) => {
        if (cooldown(name) && fonts[font]) {
          textFonts[name] = font;
          this.omegga.broadcast(`"Setting <b>${name}</> font to <b>${font}</>"`);
        }
      })
      // list fonts
      .on('chatcmd:text:fonts', name => {
        if (cooldown(name)) {
          this.omegga.broadcast(`"<b>Fonts</>: ${Object.keys(fonts).map(f => `<code>${f}</>`).join(', ')}"`);
        }
      });
  }

  stop() {
    this.omegga
      .removeAllListeners('chatcmd:text')
      .removeAllListeners('chatcmd:text:center')
      .removeAllListeners('chatcmd:text:color')
      .removeAllListeners('chatcmd:text:font')
      .removeAllListeners('chatcmd:text:fonts');
  }

  // load text in
  async cmdText(name, message, centered) {
    const player = this.omegga.getPlayer(name);

    try {
      let [x, y, z] = await player.getPosition();
      // round off player position
      x = Math.floor(x);
      y = Math.floor(y);
      z = Math.floor(z);

      // load the text save data as this owner
      this.omegga.loadSaveData(fonts[textFonts[name] || 'default'].text(message, {
        shift: [x, y, z - 27],
        color: textColors[name] || [0, 0, 0],
        author: player,
        centered,
      }), {quiet: true});
    } catch (e) {
      this.omegga.broadcast(`"Could not find <b>${name}</>"`);
    }
  }
};