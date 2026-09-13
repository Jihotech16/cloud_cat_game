-- Import the approved artwork without redrawing it. Run from the project root.
local source = Image{fromFile="resources/cloud-sheets/cloud-bounce-reference.png"}
assert(source.width == 1774 and source.height == 887, "Unexpected reference dimensions")
local pc = app.pixelColor
-- Remove green-screen pixels and soften mixed green edge pixels.
for it in source:pixels() do
  local p = it()
  local r,g,b = pc.rgbaR(p),pc.rgbaG(p),pc.rgbaB(p)
  local excess = g - math.max(r,b)
  if excess > 100 then
    it(0)
  elseif excess > 0 then
    it(pc.rgba(r, math.max(r,b), b, math.floor(255*(1-excess/100))))
  end
end
local cuts = {0,458,885,1317,1774}
local w,h,top = 458,420,240
local sprite = Sprite(w,h,ColorMode.RGB)
sprite.layers[1].name = "Cloud body"
local effectLayer = sprite:newLayer()
effectLayer.name = "Arrows rising from cloud"
local sheet = Image(w*4,h,ColorMode.RGB)
sheet:clear()
-- Trace the rounded top of the cloud, rather than cutting it horizontally.
local contour = {{0,330},{15,298},{40,278},{70,277},{95,283},
  {125,293},{160,298},{195,290},{230,290},{270,291},{305,295},
  {345,278},{380,278},{420,292},{445,306},{457,335}}
local function surfaceAt(x)
  for j=2,#contour do
    local a,b=contour[j-1],contour[j]
    if x<=b[1] then return math.floor(a[2]+(b[2]-a[2])*(x-a[1])/(b[1]-a[1])) end
  end
  return 335
end
for f=1,4 do
  if f>1 then sprite:newEmptyFrame() end
  local img = Image(w,h,ColorMode.RGB)
  img:clear()
  local left,right = cuts[f],cuts[f+1]
  local offset = math.floor((w-(right-left))/2)
  for y=0,h-1 do
    for x=left,right-1 do img:drawPixel(offset+x-left,y,source:getPixel(x,top+y)) end
  end
  -- Keep the original body in place; move the upper arrow artwork upwards.
  -- Clip behind the cloud surface so arrows emerge from it instead of hovering.
  local body = Image(w,h,ColorMode.RGB)
  local effect = Image(w,h,ColorMode.RGB)
  body:clear()
  effect:clear()
  local offsets = {255,170,85,0}
  local opacity = {0.85,1,0.85,0.30}
  for y=0,h-1 do
    for x=0,w-1 do
      local surface = surfaceAt(x)
      local p = img:getPixel(x,y)
      if y>=surface then
        body:drawPixel(x,y,p)
      else
        local destY = y+offsets[f]
        if destY<surface then
          effect:drawPixel(x,destY,pc.rgba(pc.rgbaR(p),pc.rgbaG(p),pc.rgbaB(p),math.floor(pc.rgbaA(p)*opacity[f])))
        end
      end
    end
  end
  sprite:newCel(sprite.layers[1],f,body,Point(0,0))
  sprite:newCel(effectLayer,f,effect,Point(0,0))
  sprite.frames[f].duration=0.167
  sheet:drawImage(body,Point((f-1)*w,0))
  sheet:drawImage(effect,Point((f-1)*w,0))
end
sprite:saveAs("assets/cloud-bounce-reference.aseprite")
sheet:saveAs("assets/cloud-bounce-reference-sheet.png")
print("Imported 4 frames, 458x420; sheet 1832x420")
