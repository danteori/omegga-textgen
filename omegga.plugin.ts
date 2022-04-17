import OmeggaPlugin, { Brick, OL, PC, PS, WriteSaveObject } from 'omegga';

import fs from 'fs';
import fontParser from './util.fontParser.js';
import CooldownProvider from './util.cooldown.js';

const {
  color: { linearRGB },
} = global.OMEGGA_UTIL;

// load in saves in font_fontname.brs format
const fonts = Object.fromEntries(
  fs
    .readdirSync(__dirname + '/fonts')
    .map(f => f.match(/font_([a-z0-9_]+)\.brs/))
    .filter(f => f)
    .map(match => {
      try {
        return [match[1], fontParser(__dirname + '/fonts/' + match[0])];
      } catch (err) {
        console.error('Error parsing font', match[1], ':', err);
      }
    })
    .filter(v => v)
);

const textFonts = {};

type Config = {
  'only-authorized': boolean;
  'authorized-users': { id: string; name: string }[];
  cooldown: number;
};
type Storage = {};

export default class TextGen implements OmeggaPlugin<Config, Storage> {
  omegga: OL;
  config: PC<Config>;
  store: PS<Storage>;

  constructor(omegga: OL, config: PC<Config>, store: PS<Storage>) {
    this.omegga = omegga;
    this.config = config;
    this.store = store;
  }

  async init() {
    const authorized = (name: string) => {
      const player = this.omegga.getPlayer(name);
      return (
        !this.config['only-authorized'] ||
        player.isHost() ||
        this.config['authorized-users'].some(p => player.id === p.id)
      );
    };

    const duration = Math.max(this.config.cooldown * 1000, 0);
    const cooldown = duration <= 0 ? () => true : CooldownProvider(duration);

    this.omegga
      // render text
      .on(
        'chatcmd:text',
        (name, ...msg) =>
          authorized(name) &&
          cooldown(name) &&
          this.cmdText(name, msg.join(' '), false)
      )

      // render centered text
      .on(
        'chatcmd:text:center',
        (name, ...msg) =>
          authorized(name) &&
          cooldown(name) &&
          this.cmdText(name, msg.join(' '), true)
      )

      // change text font
      .on('chatcmd:text:font', (name, font) => {
        if (authorized(name) && cooldown(name) && fonts[font]) {
          textFonts[name] = font;
          this.omegga.broadcast(
            `"Setting <b>${name}</> font to <b>${font}</>"`
          );
        }
      })
      // list fonts
      .on('chatcmd:text:fonts', name => {
        if (authorized(name) && cooldown(name)) {
          this.omegga.broadcast(
            `"<b>Fonts</>: ${Object.keys(fonts)
              .map(f => `<code>${f}</>`)
              .join(', ')}"`
          );
        }
      });
  }

  async stop() {
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

    if (message.trim().length === 0) return;

    try {
      const paint = await player.getPaint();
      const save: WriteSaveObject = fonts[textFonts[name] || 'default'].text(
        message,
        {
          shift: [0, 0, 0],
          color: paint.color || [0, 0, 0],
          author: player,
          centered,
        }
      );
      save.materials = save.materials.map(m => paint.material);

      if (save.bricks.length === 0) return;
      // load the text save data as this owner
      this.omegga.loadSaveDataOnPlayer(save, player);
    } catch (e) {
      this.omegga.broadcast(`"Could not find <b>${name}</>"`);
    }
  }
}
