import dynamic from 'next/dynamic';

const FloorPlanMap = dynamic(
  () => import('./FloorPlanMapInner'),
  { ssr: false }
);

export default FloorPlanMap;
