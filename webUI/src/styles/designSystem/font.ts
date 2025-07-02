const fontFamily = "Pretendard" as const;

//Font weight for design system
const fontWeight = {
  regular: 400,
  medium: 500,
  semiBold: 600,
  bold: 700,
} as const;

//Font size for design system
const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 32,
} as const;

//Font for design system
const font = {
  xsRegular: getFont(fontWeight.regular, fontSize.xs, fontFamily),
  xsMedium: getFont(fontWeight.medium, fontSize.xs, fontFamily),
  xsSemiBold: getFont(fontWeight.semiBold, fontSize.xs, fontFamily),
  xsBold: getFont(fontWeight.bold, fontSize.xs, fontFamily),

  smRegular: getFont(fontWeight.regular, fontSize.sm, fontFamily),
  smMedium: getFont(fontWeight.medium, fontSize.sm, fontFamily),
  smSemiBold: getFont(fontWeight.semiBold, fontSize.sm, fontFamily),
  smBold: getFont(fontWeight.bold, fontSize.sm, fontFamily),

  mdRegular: getFont(fontWeight.regular, fontSize.md, fontFamily),
  mdMedium: getFont(fontWeight.medium, fontSize.md, fontFamily),
  mdSemiBold: getFont(fontWeight.semiBold, fontSize.md, fontFamily),
  mdBold: getFont(fontWeight.bold, fontSize.md, fontFamily),

  lgRegular: getFont(fontWeight.regular, fontSize.lg, fontFamily),
  lgMedium: getFont(fontWeight.medium, fontSize.lg, fontFamily),
  lgSemiBold: getFont(fontWeight.semiBold, fontSize.lg, fontFamily),
  lgBold: getFont(fontWeight.bold, fontSize.lg, fontFamily),

  xlRegular: getFont(fontWeight.regular, fontSize.xl, fontFamily),
  xlMedium: getFont(fontWeight.medium, fontSize.xl, fontFamily),
  xlSemiBold: getFont(fontWeight.semiBold, fontSize.xl, fontFamily),
  xlBold: getFont(fontWeight.bold, fontSize.xl, fontFamily),
} as const;

function getFont(weight: number, size: number, fontFamily: string) {
  return `${weight} ${size}px ${fontFamily}`;
}

export default font;
