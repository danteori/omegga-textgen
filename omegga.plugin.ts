import OmeggaPlugin, { OL, PC, PS, WriteSaveObject } from 'omegga';
import fs from 'fs';
import CooldownProvider from './util.cooldown.js';
import fontParser from './util.fontParser.js';

// load in saves in font_fontname.brs format
let fonts;
const textFonts = {};

type Config = {
  'only-authorized': boolean;
  'authorized-users': { id: string; name: string }[];
  'authorized-roles': string[];
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
    // parse fonts on load
    (async () => {
      const matches = fs
        .readdirSync(__dirname + '/../fonts')
        .map(f => f.match(/font_([a-z0-9_]+)\.brs$/))
        .filter(f => f);

      const parsedFonts = [];
      console.info('Parsing', matches.length, 'fonts');
      for (const match of matches) {
        try {
          parsedFonts.push([
            match[1],
            await fontParser(__dirname + '/../fonts/' + match[0]),
          ]);
        } catch (err) {
          console.error('Error parsing font', match[1], ':', err);
        }
      }
      fonts = Object.fromEntries(parsedFonts);
      console.info('Loaded', parsedFonts.length, 'fonts');
    })();

    const authorized = (name: string) => {
      const player = this.omegga.getPlayer(name);
      return (
        !this.config['only-authorized'] ||
        player.isHost() ||
        this.config['authorized-users'].some(p => player.id === p.id) ||
        player
          .getRoles()
          .some(role => this.config['authorized-roles'].includes(role))
      );
    };

    const duration = Math.max(this.config.cooldown * 1000, 0);
    const cooldown = duration <= 0 ? () => true : CooldownProvider(duration);

    this.omegga
      // render text
      .on(
        'chatcmd:text',
        (name: string, ...msg: string[]) =>
          authorized(name) &&
          cooldown(name) &&
          this.cmdText(name, msg.join(' '))
      )

      // change text font
      .on('chatcmd:text:font', (name, font) => {
        if (!fonts) {
          Omegga.whisper(name, 'Fonts are still being loaded...');
          return;
        }
        if (authorized(name) && cooldown(name) && fonts[font]) {
          textFonts[name] = font;
          this.omegga.broadcast(
            `"Setting <b>${name}</> font to <b>${font}</>"`
          );
        }
      })
      // list fonts
      .on('chatcmd:text:fonts', (name: string) => {
        if (!fonts) {
          Omegga.whisper(name, 'Fonts are still being loaded...');
          return;
        }
        if (authorized(name) && cooldown(name)) {
          this.omegga.broadcast(
            `"<b>Fonts</>: ${Object.keys(fonts)
              .map(f => `<code>${f}</>`)
              .join(', ')}"`
          );
        }
      });
  }

  async stop() {}

  // load text in
  async cmdText(name: string, message: string) {
    const player = this.omegga.getPlayer(name);

    if (message.trim().length === 0) return;
    if (!fonts) {
      Omegga.whisper(name, 'Fonts are still being loaded...');
      return;
    }

    try {
      const paint = await player.getPaint();
      const save: WriteSaveObject = fonts[textFonts[name] || 'default'].text(
        message,
        {
          shift: [0, 0, 0],
          color: paint.color || [0, 0, 0],
          author: player,
          centered: false,
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
