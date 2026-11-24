import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = process.cwd();

test('Multiplayer HUD, Matchmaking Lobby, and Chat in src/App.tsx are properly present', () => {
  const appTsx = fs.readFileSync(path.join(ROOT, 'src/App.tsx'), 'utf-8');

  // Must include multiplayer, game, and camera controls
  for (const requiredId of [
    'btn-lobby',
    'lobby-modal',
    'room-pill',
    'btn-create-room',
    'btn-join-room',
    'input-room-code',
    'modal-room-code',
    'btn-copy-code',
    'btn-copy-link',
    'chat-drawer',
    'btn-toggle-chat',
    'opponent-toast',
    'btn-side-toggle',
    'btn-ai-move',
    'btn-reset',
    'btn-cam-player',
    'btn-cam-top',
    'btn-cam-side',
    'btn-cam-wide',
    'btn-hide-ui',
    'controls-hint',
    'captured-tray'
  ]) {
    assert.ok(appTsx.includes(`id="${requiredId}"`), `Missing required control #${requiredId}`);
  }
});

test('Real-time multiplayer server.ts implements WebSocket server and REST endpoints', () => {
  const serverTs = fs.readFileSync(path.join(ROOT, 'server.ts'), 'utf-8');
  assert.ok(serverTs.includes('WebSocketServer'), 'Missing WebSocketServer in server.ts');
  assert.ok(serverTs.includes('/api/rooms/create'), 'Missing /api/rooms/create endpoint');
  assert.ok(serverTs.includes('/api/rooms/join'), 'Missing /api/rooms/join endpoint');
  assert.ok(serverTs.includes('/api/rooms/:code/move'), 'Missing /api/rooms/:code/move endpoint');
});

test('All 7 compressed 3D assets (.glb.gz.b64) decode and gunzip to valid glTF 2.0 binary models', () => {
  const expectedModels = [
    'option8_cathedral',
    'pawn_white',
    'rook_white',
    'knight_white',
    'bishop_white',
    'queen_white',
    'king_white'
  ];

  for (const name of expectedModels) {
    const b64Path = path.join(ROOT, 'public/assets/glb', `${name}.glb.gz.b64`);
    assert.ok(fs.existsSync(b64Path), `Missing 3D asset ${b64Path}`);
    const b64Text = fs.readFileSync(b64Path, 'utf-8').trim();
    assert.ok(b64Text.length > 1000, `Asset ${name}.glb.gz.b64 is unexpectedly small`);

    const gzBuf = Buffer.from(b64Text, 'base64');
    const glbBuf = zlib.gunzipSync(gzBuf);

    const magic = glbBuf.toString('ascii', 0, 4);
    const version = glbBuf.readUInt32LE(4);
    const totalLen = glbBuf.readUInt32LE(8);
    assert.equal(magic, 'glTF', `Invalid glTF magic header for ${name}`);
    assert.equal(version, 2, `Invalid glTF version for ${name}`);
    assert.equal(totalLen, glbBuf.length, `Mismatched glTF byte length for ${name}`);
  }
});

test('Full-bleed Starting Page Hub, game modes, and visual assets are verified in src/App.tsx', () => {
  const appTsx = fs.readFileSync(path.join(ROOT, 'src/App.tsx'), 'utf-8');

  // Verify full-bleed start screen hub container
  assert.ok(appTsx.includes('start-page-screen'), 'Missing start-page-screen container');
  assert.ok(appTsx.includes('start-fullscreen-hub'), 'Missing start-fullscreen-hub class');

  // Verify visual assets referenced in App.tsx
  assert.ok(appTsx.includes('fullscreen_sanctum_bg'), 'Missing fullscreen background asset');
  assert.ok(appTsx.includes('hero_cathedral_banner'), 'Missing hero cathedral banner asset');
  assert.ok(appTsx.includes('mode_single_player'), 'Missing mode_single_player asset');
  assert.ok(appTsx.includes('mode_multiplayer_duel'), 'Missing mode_multiplayer_duel asset');
  assert.ok(appTsx.includes('mode_pass_and_play'), 'Missing mode_pass_and_play asset');

  // Verify mobile app bottom dock navigation buttons
  assert.ok(appTsx.includes('hub-bottom-dock'), 'Missing mobile navigation bottom dock');
  assert.ok(appTsx.includes('Arena Rooms'), 'Missing Arena Rooms navigation');
  assert.ok(appTsx.includes('Settings'), 'Missing Settings navigation');
  assert.ok(appTsx.includes('Lore &amp; Rules'), 'Missing Lore & Rules navigation');
  assert.ok(appTsx.includes('Vault'), 'Missing Vault navigation');
});

