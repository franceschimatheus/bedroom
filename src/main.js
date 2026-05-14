import './style.css';
import { RoomRenderer } from './renderer.js';
import roomData from './room.json';

const appDiv = document.getElementById('app');

// Create UI overlay
const uiDiv = document.createElement('div');
uiDiv.id = 'ui';
uiDiv.innerHTML = `
  <h1>3D Room Viewer</h1>
  <p>Edit <code>src/room.json</code> to see live updates.</p>
  <div style="margin-top: 15px;">
    <label for="opacitySlider" style="font-size: 13px; font-weight: 500; color: #333;">Opacidade das Paredes:</label>
    <br/>
    <input type="range" id="opacitySlider" min="0" max="1" step="0.05" value="0.5" style="width: 100%; margin-top: 5px; cursor: pointer;">
  </div>
`;
appDiv.appendChild(uiDiv);

const opacitySlider = document.getElementById('opacitySlider');

// Initialize renderer
const renderer = new RoomRenderer(appDiv);
renderer.init();

// Initial load
renderer.loadRoom(roomData);
if (roomData.room && roomData.room.wallOpacity !== undefined) {
  opacitySlider.value = roomData.room.wallOpacity;
}

opacitySlider.addEventListener('input', (e) => {
  const value = parseFloat(e.target.value);
  renderer.updateWallOpacity(value);
});

// Handle Vite HMR for room.json
if (import.meta.hot) {
  import.meta.hot.accept('./room.json', (newModule) => {
    if (newModule) {
      console.log('Room data updated via HMR');
      const data = newModule.default;
      renderer.loadRoom(data);
      if (data.room && data.room.wallOpacity !== undefined) {
        opacitySlider.value = data.room.wallOpacity;
      }
    }
  });
}
