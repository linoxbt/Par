import { Composition } from "remotion"
import { ParDemo } from "./Video"
import tl from "./timeline.json"

export const Root = () => (
  <Composition id="ParDemo" component={ParDemo} durationInFrames={tl.frames} fps={tl.fps} width={1920} height={1080} />
)
