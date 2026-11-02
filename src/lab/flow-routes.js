import { stations, stationDimensions } from "./scene-layout.js";

export const stationElevations = Object.fromEntries(stations.map(s => [s.id,
  ({benign:2.803,review:1.1625,isolate:-.295,audit:-1.6,investigate:-.10}[s.id] ?? .25)]));
export const docks = Object.fromEntries(stations.map(s => {
  const {width,depth}=stationDimensions(s.id);
  return [s.id, [s.x+(s.id==='audit'?width/2+.1:0), s.id==='investigate'?stationElevations[s.id]+.04:["benign","review","isolate","audit"].includes(s.id) ? stationElevations[s.id] + .24 : .24,
    s.z + (s.id === "audit" ? .4 : depth/2+(s.id==='isolate'?.25:.35))]];
}));

const via = (from, to, points = []) => {
  const start=docks[from], end=docks[to];
  return [start, ...(start[1]!==.24?[[start[0],.24,start[2]]]:[]),
    ...points.map(([x,z])=>[x,.24,z]), ...(end[1]>.24?[[end[0],.24,end[2]]]:[]), end];
};
export const routeWaypoints = {
  "detect:orchestrate": via("detect", "orchestrate", [[-10.2,5.25],[-9.6,5.8],[-8.5,5.8],[-8,5.35]]),
  "orchestrate:investigate": via("orchestrate", "investigate", [[-4,5.35],[-3.6,5.8],[-2.4,5.8],[-2,4.65]]),
  "investigate:decision": via("investigate", "decision"),
  "decision:malware": via("decision", "malware", [[8,5.95],[8,5.05]]),
  "decision:review": via("decision", "review", [[7.5,5.95],[7.5,-4.45]]),
  "decision:benign": via("decision", "benign", [[2.7,5.95],[2.7,-5.95]]),
  "orchestrate:isolate": via("orchestrate", "isolate", [[-8.4,5.35],[-8.4,-8.15],[16,-8.15],[16,-2.75]]),
  "isolate:investigate": via("isolate", "investigate", [[16,-2.75],[16,6.8],[0,6.8]]),
  "review:malware": via("review", "malware", [[11.9,-4.45],[11.9,5.05]]),
  "review:benign": via("review", "benign", [[1,-4.45],[1,-5.95]]),
  "malware:audit": via("malware", "audit", [[10,9.3]]),
  "benign:audit": via("benign", "audit", [[2.6,-5.95],[2.6,10.9]]),
  "review:audit": via("review", "audit", [[7.5,-4.45],[7.5,10.9]]),
  "isolate:audit": via("isolate", "audit", [[16,-2.75],[16,10.9]]),
  "orchestrate:audit": via("orchestrate", "audit", [[-5.8,10.9]]),
};

export function getRouteState(state) {
  const nodes = state.events.map(e => e.node).filter((node,i,all) => i === 0 || node !== all[i-1]);
  const visited = nodes.slice(1).map((node,i) => `${nodes[i]}:${node}`);
  return { visited, active: state.complete ? null : visited.at(-1) || null, node: state.node };
}
