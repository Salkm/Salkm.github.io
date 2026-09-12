export function getOwnedPortraitRect(width, height, mobile) {
  if (!mobile) {
    const size = height * .8704;
    const left = Math.min(width / 2 - height * .164, width - size * .83 - 24);
    return { left, top: height * .151, width: size, height: size };
  }
  // Place the unmodified square portrait in the reference's 896x1152 mobile composition.
  const scale = Math.max(width / 896, height / 1152);
  return { left: width / 2 - 372 * scale, top: height / 2 - 386 * scale, width: 960 * scale, height: 960 * scale };
}

export function getOwnedVideoRect(width, height, mobile, aspect) {
  const portrait = getOwnedPortraitRect(width, height, mobile);
  // Face-region alignment of the landscape Flow source against the original square portrait.
  const videoWidth = portrait.width * 706 / 384;
  return {
    left: portrait.left - portrait.width * 159 / 384,
    top: portrait.top - portrait.width * 13 / 384,
    width: videoWidth,
    height: videoWidth / aspect,
  };
}
