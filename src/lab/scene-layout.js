import { stations as workflowStations } from './workflow.js';

// Visual calibration only; semantic station IDs and incident decisions stay in workflow.js.
const placement = {
  detect: [-12.1, 3.1],
  orchestrate: [-6.2, 3.2],
  investigate: [-.15, 2.5],
  decision: [6.0, 3.8],
  benign: [3.75, -8.1],
  review: [4.85, -6.6],
  malware: [10.0, 2.9],
  isolate: [14.1, -5.6],
  audit: [4.1, 9.2],
};
export const stations = workflowStations.map(station => ({
  ...station, x: placement[station.id][0], z: placement[station.id][1],
}));
export const labelHeight = id => id === 'audit' ? 2.083 : id === 'decision' ? 2.125 : id === 'investigate' ? 4.0875 : id === 'isolate' ? 3.15 : 3.65;
export const stationHeightScale = id => ({audit:1.2,benign:.58,review:.55,isolate:1.1}[id] ?? .8);
export const stationDimensions = id => ({
  width: id === 'audit' ? 7.1 : id === 'isolate' ? 3.45 : 4.35,
  depth: id === 'isolate' ? 3.0 : 3.6,
  height: id === 'isolate' ? 3.75 : 3.8,
});
