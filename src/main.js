import './style.css';
import { RoomRenderer } from './renderer.js';
import roomData1 from './room-1.json';
import roomData2 from './room-2.json';
import roomData6 from './room-6.json';

const rooms = {
  'room-1': roomData1,
  'room-2': roomData2,
  'room-6': roomData6,
};

const appDiv = document.getElementById('app');

// Create UI overlay
const uiDiv = document.createElement('div');
uiDiv.id = 'ui';
uiDiv.innerHTML = `
  <h1>3D Room Viewer</h1>
  <div style="margin-top: 10px;">
    <label for="roomSelect" style="font-size: 13px; font-weight: 500; color: #333;">Room Layout:</label>
    <br/>
    <select id="roomSelect" style="width: 100%; margin-top: 5px; padding: 4px 6px; cursor: pointer; border-radius: 4px; border: 1px solid #ccc;">
      <option value="room-1" selected>Room 1 (Original)</option>
      <option value="room-2">Room 2 (Full-wall desk)</option>
      <option value="room-6">Room 6 (Room 2 180x70)</option>
    </select>
  </div>
  <div style="margin-top: 15px;">
    <label for="opacitySlider" style="font-size: 13px; font-weight: 500; color: #333;">Wall Opacity:</label>
    <br/>
    <input type="range" id="opacitySlider" min="0" max="1" step="0.05" value="0.5" style="width: 100%; margin-top: 5px; cursor: pointer;">
  </div>
`;
appDiv.appendChild(uiDiv);

// Tooltip
const tooltip = document.createElement('div');
tooltip.id = 'tooltip';
tooltip.style.cssText = `
  position: fixed;
  pointer-events: none;
  background: rgba(15, 10, 35, 0.88);
  color: #e2d9f3;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  font-family: 'Inter', system-ui, sans-serif;
  border: 1px solid rgba(168, 85, 247, 0.5);
  box-shadow: 0 4px 16px rgba(124, 58, 237, 0.3);
  letter-spacing: 0.02em;
  white-space: nowrap;
  display: none;
  z-index: 1000;
  transition: opacity 0.1s ease;
`;
document.body.appendChild(tooltip);

const opacitySlider = document.getElementById('opacitySlider');
const roomSelect = document.getElementById('roomSelect');

// Initialize renderer
const renderer = new RoomRenderer(appDiv);
renderer.init();

function loadSelectedRoom() {
  const key = roomSelect.value;
  const data = rooms[key];
  if (!data) return;
  
  renderer.loadRoom(data);
  if (data.room && data.room.wallOpacity !== undefined) {
    opacitySlider.value = data.room.wallOpacity;
  }
}

// Initial load
loadSelectedRoom();

renderer.setTooltipCallback((name, x, y) => {
  if (name) {
    tooltip.textContent = name;
    tooltip.style.display = 'block';
    tooltip.style.left = (x + 14) + 'px';
    tooltip.style.top = (y - 10) + 'px';
  } else {
    tooltip.style.display = 'none';
  }
});

roomSelect.addEventListener('change', loadSelectedRoom);

opacitySlider.addEventListener('input', (e) => {
  const value = parseFloat(e.target.value);
  renderer.updateWallOpacity(value);
});

// Handle Vite HMR
if (import.meta.hot) {
  import.meta.hot.accept(['./room-1.json', './room-2.json', './room-6.json'], () => {
    loadSelectedRoom();
  });
}
