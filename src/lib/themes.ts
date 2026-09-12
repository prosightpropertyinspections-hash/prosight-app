export interface ThemeTokens {
  id: string;
  name: string;
  blurb: string;
  // page
  pageBg: string;
  ink: string;
  sub: string;
  hair: string;
  // brand accent(s)
  accent: string;
  accent2: string;
  // cover
  coverBg: string;
  coverInk: string;
  coverAccent: string;
  // fonts
  displayFont: string;   // headings / cover
  bodyFont: string;      // body
  // feel
  radius: number;        // corner radius on cards
  coverStyle: "monograph" | "obsidian" | "warrant" | "vanguard" | "terra" | "noir" | "aurora" | "prestige" | "blueprint";
  gradeStyle: "seal" | "number" | "certificate" | "block" | "glow";
  layout: "editorial" | "band" | "technical" | "minimal";  // inner-page structure family
  // severity palette
  sev: {
    priority:{c:string;bg:string};
    monitor:{c:string;bg:string};
    satisfactory:{c:string;bg:string};
  };
  gradeColor: Record<string,string>;
}

const SERIF = 'Georgia, "Times New Roman", "Iowan Old Style", serif';
const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';

export const THEMES: Record<string, ThemeTokens> = {
  estate: {
    id:"estate", name:"Estate", blurb:"Architectural monograph — luxury real estate",
    pageBg:"#ffffff", ink:"#242019", sub:"#8a8172", hair:"#e6e0d4",
    accent:"#9c7b3f", accent2:"#3d4a3e",
    coverBg:"#f7f4ee", coverInk:"#242019", coverAccent:"#9c7b3f",
    displayFont:'"Cormorant Garamond", Georgia, serif', bodyFont:SERIF,
    radius:2, coverStyle:"monograph", gradeStyle:"seal",
    layout:"editorial",
    sev:{ priority:{c:"#8f3a2f",bg:"#f4e9e5"}, monitor:{c:"#9c7b3f",bg:"#f4eede"}, satisfactory:{c:"#3d4a3e",bg:"#e9efe8"} },
    gradeColor:{A:"#3d4a3e",B:"#5f7355",C:"#9c7b3f",D:"#b5763e",F:"#8f3a2f"},
  },
  obsidian: {
    id:"obsidian", name:"Obsidian", blurb:"Dark premium — modern & data-forward",
    pageBg:"#0e0f12", ink:"#eef0f3", sub:"#8b9099", hair:"#24272d",
    accent:"#c98a4b", accent2:"#5aa0d2",
    coverBg:"#0a0b0d", coverInk:"#ffffff", coverAccent:"#c98a4b",
    displayFont:'"Space Grotesk", "Helvetica Neue", sans-serif', bodyFont:SANS,
    radius:6, coverStyle:"obsidian", gradeStyle:"number",
    layout:"technical",
    sev:{ priority:{c:"#e5675b",bg:"#2a1613"}, monitor:{c:"#d9a441",bg:"#241d10"}, satisfactory:{c:"#4fb984",bg:"#10251c"} },
    gradeColor:{A:"#4fb984",B:"#6db36a",C:"#d9a441",D:"#e0803a",F:"#e5675b"},
  },
  warrant: {
    id:"warrant", name:"Warrant", blurb:"Formal & institutional — carries authority",
    pageBg:"#ffffff", ink:"#1a2230", sub:"#5a6675", hair:"#d9dee6",
    accent:"#1c3d5a", accent2:"#8a6d3b",
    coverBg:"#132538", coverInk:"#ffffff", coverAccent:"#c2a15a",
    displayFont:'"Libre Baskerville", Georgia, serif', bodyFont:SERIF,
    radius:3, coverStyle:"warrant", gradeStyle:"certificate",
    layout:"band",
    sev:{ priority:{c:"#a8322a",bg:"#f6eae9"}, monitor:{c:"#8a6d3b",bg:"#f4eee0"}, satisfactory:{c:"#2f6b4a",bg:"#e7f1ea"} },
    gradeColor:{A:"#2f6b4a",B:"#4f8a63",C:"#8a6d3b",D:"#b06a34",F:"#a8322a"},
  },
  vanguard: {
    id:"vanguard", name:"Vanguard", blurb:"Bold graphic sans — confident & modern",
    pageBg:"#ffffff", ink:"#161616", sub:"#6d6d6d", hair:"#e7e7e7",
    accent:"#e4552b", accent2:"#161616",
    coverBg:"#161616", coverInk:"#ffffff", coverAccent:"#e4552b",
    displayFont:'"Archivo", "Helvetica Neue", sans-serif', bodyFont:SANS,
    radius:0, coverStyle:"vanguard", gradeStyle:"block",
    layout:"band",
    sev:{ priority:{c:"#d43b1e",bg:"#fbe9e4"}, monitor:{c:"#c47a10",bg:"#fbf1de"}, satisfactory:{c:"#2f8a52",bg:"#e6f3ec"} },
    gradeColor:{A:"#2f8a52",B:"#5a9e56",C:"#c47a10",D:"#d97032",F:"#d43b1e"},
  },
  terra: {
    id:"terra", name:"Terra", blurb:"Warm & earthy — boutique premium",
    pageBg:"#faf7f2", ink:"#33291f", sub:"#8a7a66", hair:"#e6ddce",
    accent:"#b5673a", accent2:"#5c6e4c",
    coverBg:"#403428", coverInk:"#f7f0e6", coverAccent:"#cf9366",
    displayFont:'"Fraunces", Georgia, serif', bodyFont:SERIF,
    radius:8, coverStyle:"terra", gradeStyle:"seal",
    layout:"editorial",
    sev:{ priority:{c:"#a8492e",bg:"#f3e5dd"}, monitor:{c:"#b5673a",bg:"#f5ebdd"}, satisfactory:{c:"#5c6e4c",bg:"#eaefe3"} },
    gradeColor:{A:"#5c6e4c",B:"#7d8a5f",C:"#b5673a",D:"#bd6a34",F:"#a8492e"},
  },
  noir: {
    id:"noir", name:"Noir", blurb:"High-fashion black & white — editorial drama",
    pageBg:"#ffffff", ink:"#0a0a0a", sub:"#767676", hair:"#111111",
    accent:"#0a0a0a", accent2:"#a0a0a0",
    coverBg:"#0a0a0a", coverInk:"#ffffff", coverAccent:"#ffffff",
    displayFont:'"Playfair Display", "Times New Roman", serif', bodyFont:SANS,
    radius:0, coverStyle:"noir", gradeStyle:"number",
    layout:"minimal",
    sev:{ priority:{c:"#0a0a0a",bg:"#f0f0f0"}, monitor:{c:"#555555",bg:"#f6f6f6"}, satisfactory:{c:"#8a8a8a",bg:"#fafafa"} },
    gradeColor:{A:"#0a0a0a",B:"#2e2e2e",C:"#565656",D:"#7e7e7e",F:"#0a0a0a"},
  },
  aurora: {
    id:"aurora", name:"Aurora", blurb:"Cinematic full-bleed cover — vivid & dramatic",
    pageBg:"#ffffff", ink:"#12141c", sub:"#6a7080", hair:"#e8eaf0",
    accent:"#6d4aff", accent2:"#ff4d8d",
    coverBg:"#0b0d18", coverInk:"#ffffff", coverAccent:"#a78bff",
    displayFont:'"Space Grotesk", "Helvetica Neue", sans-serif', bodyFont:SANS,
    radius:12, coverStyle:"aurora", gradeStyle:"glow",
    layout:"technical",
    sev:{ priority:{c:"#e0416b",bg:"#fbe8ee"}, monitor:{c:"#c9861f",bg:"#faf1de"}, satisfactory:{c:"#2f9d6b",bg:"#e6f5ee"} },
    gradeColor:{A:"#2f9d6b",B:"#5aa972",C:"#c9861f",D:"#dd6b45",F:"#e0416b"},
  },
  prestige: {
    id:"prestige", name:"Prestige", blurb:"Emerald & gold with glow — old-money luxury",
    pageBg:"#fbfaf6", ink:"#1a2b23", sub:"#7a8578", hair:"#e2e0d2",
    accent:"#b6923f", accent2:"#143d2e",
    coverBg:"#0e2a1f", coverInk:"#f4efe0", coverAccent:"#d4af5f",
    displayFont:'"Cormorant Garamond", Georgia, serif', bodyFont:SERIF,
    radius:6, coverStyle:"prestige", gradeStyle:"glow",
    layout:"editorial",
    sev:{ priority:{c:"#9c3b2e",bg:"#f2e6e2"}, monitor:{c:"#b6923f",bg:"#f5efdd"}, satisfactory:{c:"#143d2e",bg:"#e4ede6"} },
    gradeColor:{A:"#143d2e",B:"#3a6b52",C:"#b6923f",D:"#bd6a34",F:"#9c3b2e"},
  },
  blueprint: {
    id:"blueprint", name:"Blueprint", blurb:"Architectural grid & glow — technical drama",
    pageBg:"#ffffff", ink:"#0f1a3c", sub:"#5a6690", hair:"#dde2f0",
    accent:"#2f6df6", accent2:"#00c2d1",
    coverBg:"#0a1230", coverInk:"#eaf0ff", coverAccent:"#4d8dff",
    displayFont:'"Space Grotesk", "Helvetica Neue", sans-serif', bodyFont:SANS,
    radius:4, coverStyle:"blueprint", gradeStyle:"glow",
    layout:"technical",
    sev:{ priority:{c:"#e0475e",bg:"#fbe9ec"}, monitor:{c:"#c98a1e",bg:"#faf1de"}, satisfactory:{c:"#1f9c8a",bg:"#e4f4f1"} },
    gradeColor:{A:"#1f9c8a",B:"#4aa79a",C:"#c98a1e",D:"#dd6b45",F:"#e0475e"},
  },
};

export const THEME_LIST = Object.values(THEMES);
export function getTheme(id?:string|null){ return (id && THEMES[id]) || THEMES.estate; }

// Google Fonts needed by the themes
export const THEME_FONT_HREF = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Space+Grotesk:wght@500;600;700&family=Libre+Baskerville:wght@400;700&family=Archivo:wght@600;700;800&family=Fraunces:wght@500;600;700&family=Playfair+Display:wght@600;700;800&display=swap";
