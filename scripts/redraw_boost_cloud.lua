local frameW, frameH = 128, 96
local frameCount = 4
local outAse = "/Users/hanjiho/Project/cloud_cat_game/assets/cloud-boost-animation.aseprite"
local outPng = "/Users/hanjiho/Project/cloud_cat_game/assets/cloud-boost-sheet.png"

local C = {
  clear = Color{ r=0, g=0, b=0, a=0 },
  outline = Color{ r=58, g=157, b=235, a=255 },
  cyan = Color{ r=82, g=220, b=245, a=255 },
  pale = Color{ r=181, g=242, b=255, a=255 },
  white = Color{ r=252, g=253, b=247, a=255 },
  shade = Color{ r=190, g=216, b=250, a=255 },
  deep = Color{ r=114, g=168, b=239, a=255 },
  yellow = Color{ r=255, g=246, b=166, a=255 },
}

local function pixel(img, x, y, color)
  if x >= 0 and y >= 0 and x < frameW and y < frameH then
    img:drawPixel(x, y, color)
  end
end

local function rect(img, x, y, w, h, color)
  for py = y, y + h - 1 do
    for px = x, x + w - 1 do pixel(img, px, py, color) end
  end
end

local function ellipse(img, cx, cy, rx, ry, color)
  for y = -ry, ry do
    for x = -rx, rx do
      if (x*x)/(rx*rx) + (y*y)/(ry*ry) <= 1 then
        pixel(img, cx+x, cy+y, color)
      end
    end
  end
end

local function sparkle(img, x, y, bright)
  local color = bright and C.yellow or C.pale
  pixel(img, x, y-2, color); pixel(img, x, y+2, color)
  pixel(img, x-2, y, color); pixel(img, x+2, y, color)
  rect(img, x-1, y-1, 3, 3, C.white)
end

local function arrow(img, cx, baseY, height, width)
  local topY = baseY - height
  rect(img, cx-2, topY+4, 5, math.max(2, height-4), C.cyan)
  rect(img, cx-1, topY+5, 2, math.max(1, height-6), C.pale)
  for i = 0, width do
    rect(img, cx-i, topY+i, 2, 2, C.outline)
    rect(img, cx+i-1, topY+i, 2, 2, C.outline)
  end
  for i = 0, width-2 do
    pixel(img, cx-i, topY+i+1, C.white)
    pixel(img, cx+i, topY+i+1, C.white)
  end
end

local function drawCloudFrame(index)
  local img = Image(frameW, frameH, ColorMode.RGB)
  img:clear(C.clear)

  local phase = index - 1
  local baseY = 70
  local lift = {0, -1, 0, 1}
  local lobeShift = {
    {0, 1, 0, 1, 0},
    {-1, 0, 1, 0, -1},
    {0, -1, 0, -1, 0},
    {1, 0, -1, 0, 1},
  }

  -- Every frame redraws the complete body with a different flowing silhouette.
  ellipse(img, 64, baseY+7+lift[index], 57, 18, C.outline)
  ellipse(img, 64, baseY+5+lift[index], 54, 16, C.pale)
  ellipse(img, 64, baseY+4+lift[index], 51, 14, C.white)

  local xs = {25, 44, 64, 84, 103}
  local rs = {16, 18, 20, 18, 16}
  for i = 1, 5 do
    local cy = baseY - 4 + lobeShift[index][i]
    ellipse(img, xs[i], cy, rs[i], 13, C.outline)
    ellipse(img, xs[i], cy-1, rs[i]-2, 11, C.pale)
    ellipse(img, xs[i], cy-3, rs[i]-4, 8, C.white)
  end

  -- Redraw the soft underside shading in every frame.
  ellipse(img, 64, baseY+10+lift[index], 48, 8, C.deep)
  ellipse(img, 64, baseY+7+lift[index], 49, 8, C.shade)
  for i = 1, 5 do
    ellipse(img, xs[i], baseY+2+lobeShift[index][i], rs[i]-5, 6, C.white)
  end

  -- Three arrows rise from the cloud surface across the four drawings.
  local heights = {8, 15, 23, 31}
  local h = heights[index]
  arrow(img, 64, baseY-9, h, 7)
  arrow(img, 39, baseY-7, math.max(6, h-7), 5)
  arrow(img, 89, baseY-7, math.max(6, h-7), 5)

  local sy = baseY - 12 - phase*5
  sparkle(img, 19+phase*2, sy+3, phase % 2 == 0)
  sparkle(img, 109-phase*2, sy-1, phase % 2 == 1)
  sparkle(img, 51-phase, sy-8, phase == 2)
  sparkle(img, 78+phase, sy-5, phase == 3)

  return img
end

local sprite = Sprite(frameW, frameH, ColorMode.RGB)
sprite.filename = outAse
sprite.frames[1].duration = 0.10
local layer = sprite.layers[1]
layer.name = "Redrawn Boost Cloud"

local images = {}
for i = 1, frameCount do
  if i > 1 then sprite:newEmptyFrame() end
  local img = drawCloudFrame(i)
  images[i] = img
  sprite:newCel(layer, i, img, Point(0, 0))
  sprite.frames[i].duration = 0.10
end
sprite:saveAs(outAse)

local sheet = Sprite(frameW * frameCount, frameH, ColorMode.RGB)
local sheetLayer = sheet.layers[1]
sheetLayer.name = "4 Frame Sheet"
local sheetImage = Image(frameW * frameCount, frameH, ColorMode.RGB)
sheetImage:clear(C.clear)
for i = 1, frameCount do
  sheetImage:drawImage(images[i], Point((i-1)*frameW, 0))
end
sheet:newCel(sheetLayer, 1, sheetImage, Point(0, 0))
sheet:saveCopyAs(outPng)
sheet:close()

app.activeSprite = sprite
app.activeFrame = 1
app.refresh()
