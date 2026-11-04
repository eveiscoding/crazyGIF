export type Template = "shake" | "dance" | "rise" | "twitch";
export type Tool = "move" | "lasso" | "erase" | "restore";
export interface Settings {
  template: Template;
  scale: number;
  x: number;
  y: number;
  rotation: number;
  background: string;
  caption: string;
  textColor: string;
  textSize: number;
  speed: number;
  intensity: number;
  duration: number;
}
export const defaults: Settings = {
  template: "shake",
  scale: 1,
  x: 0,
  y: 0,
  rotation: 0,
  background: "#e8f59b",
  caption: "今天也要发疯！",
  textColor: "#ffffff",
  textSize: 29,
  speed: 1,
  intensity: 0.6,
  duration: 2,
};
export const templates: {
  id: Template;
  name: string;
  sub: string;
  icon: string;
  color: string;
}[] = [
  {
    id: "shake",
    name: "疯狂摇头",
    sub: "烦恼全甩掉",
    icon: "↔",
    color: "#e9f3b3",
  },
  {
    id: "dance",
    name: "精神蹦迪",
    sub: "灵魂开始律动",
    icon: "✳",
    color: "#e8def8",
  },
  {
    id: "rise",
    name: "旋转升天",
    sub: "快乐到起飞",
    icon: "↗",
    color: "#ffd8c3",
  },
  {
    id: "twitch",
    name: "抽搐抖动",
    sub: "状态十分美丽",
    icon: "ϟ",
    color: "#d0e9f0",
  },
];
