import Foundation
import AppKit
import CoreText
import ImageIO
import UniformTypeIdentifiers

// Renders the Clastor email wordmark: "Clastor" in Delius Swash Caps, on the
// email card's cream background (#fffdf9), at 2x for retina. Uses plain
// CoreText in a CGBitmapContext (unflipped, bottom-left origin — CTLineDraw
// renders glyphs upright there with no transform juggling).
//
// The companion logo mark (shown left of the wordmark in the email header)
// is NOT rendered here — it's rasterized straight from
// frontend/public/logo.svg via macOS QuickLook, or can be replaced by any
// hand-made 2x PNG dropped into frontend/public/assets/ (then update the
// width/height attributes in backend/src/services/emailLayout.ts).

let args = CommandLine.arguments
guard args.count == 3 else {
    FileHandle.standardError.write("usage: render_wordmark <font.ttf> <out.png>\n".data(using: .utf8)!)
    exit(1)
}
let fontURL = URL(fileURLWithPath: args[1])
let outURL = URL(fileURLWithPath: args[2])

// Register the font from file without installing it system-wide.
var error: Unmanaged<CFError>?
guard CTFontManagerRegisterFontsForURL(fontURL as CFURL, .process, &error) else {
    FileHandle.standardError.write("font registration failed: \(error!.takeRetainedValue())\n".data(using: .utf8)!)
    exit(1)
}

let fontSize: CGFloat = 76          // 2x; displays at 38px
let ink = CGColor(red: 0x2b/255, green: 0x21/255, blue: 0x18/255, alpha: 1)
let card = CGColor(red: 1.0, green: 0xfd/255, blue: 0xf9/255, alpha: 1)

let font = CTFontCreateWithName("DeliusSwashCaps-Regular" as CFString, fontSize, nil)
let text = NSAttributedString(string: "Clastor", attributes: [
    .font: font,
    .foregroundColor: ink,
])
let line = CTLineCreateWithAttributedString(text)

// Measure the actual glyph INK extents, not the font's typographic bounds —
// this font's swashes overshoot ascent/descent, which clipped the previous
// render. The optical-bounds rect is in line space (baseline at y = 0), so
// origin.y is negative (ink below baseline).
let inkRect = CTLineGetBoundsWithOptions(line, .useOpticalBounds)
let inkW = ceil(inkRect.width)
let inkH = ceil(inkRect.height)

let padding: CGFloat = 8           // 2x

let width = ceil(padding * 2 + inkW)
let height = ceil(padding * 2 + inkH)

guard let ctx = CGContext(
    data: nil, width: Int(width), height: Int(height),
    bitsPerComponent: 8, bytesPerRow: 0,
    space: CGColorSpaceCreateDeviceRGB(),
    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
) else {
    FileHandle.standardError.write("context failed\n".data(using: .utf8)!)
    exit(1)
}

// Card-coloured background (solid, no alpha — Outlook composites it badly).
ctx.setFillColor(card)
ctx.fill(CGRect(x: 0, y: 0, width: width, height: height))

// Draw the line so its ink rect sits exactly at (padding, padding) from the
// bottom-left — guarantees nothing is clipped and the ink block is perfectly
// centred between the paddings.
ctx.textPosition = CGPoint(x: padding - inkRect.minX, y: padding - inkRect.minY)
CTLineDraw(line, ctx)

guard let image = ctx.makeImage() else {
    FileHandle.standardError.write("image failed\n".data(using: .utf8)!)
    exit(1)
}
guard let dest = CGImageDestinationCreateWithURL(outURL as CFURL, UTType.png.identifier as CFString, 1, nil) else {
    FileHandle.standardError.write("dest failed\n".data(using: .utf8)!)
    exit(1)
}
CGImageDestinationAddImage(dest, image, nil)
guard CGImageDestinationFinalize(dest) else {
    FileHandle.standardError.write("encode failed\n".data(using: .utf8)!)
    exit(1)
}
print("SIZE \(Int(width))x\(Int(height))")
