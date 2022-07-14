# textgen plugin

A text generator command for [omegga](https://github.com/brickadia-community/omegga).

## Install

Easy: `omegga install gh:Meshiest/textgen`

Manual:

* `git clone https://github.com/meshiest/omegga-textgen textgen` in `plugins` directory
* `npm i` in `textgen` directory

## Screenshot

![](https://i.imgur.com/bodEKfY.png)

## Commands

Generate text in-game under your player with the following commands:

| Command | Description |
| - | - |
| `!text (message)` | Generate a message underneath your character.
| `!text:center (message)` | Generate a message centered beneath your character.
| `!text:color (hex)` | Sets the color of future generated text. This should be a hexadecimal color code, such as `ff0000` for red.
| `!text:font (font)` | Sets the font of future generated text. Use the `!text:fonts` command to view the available fonts.
| `!text:fonts` | Lists available fonts for the `!text:font` command.
