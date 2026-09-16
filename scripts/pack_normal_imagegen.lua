-- Remove generated exterior glow, retaining the light cloud and a narrow outline.
local src=Image{fromFile="resources/cloud-sheets/cloud-normal-imagegen.png"}
assert(src.width==1024 and src.height==1536)
local pc=app.pixelColor
local w,h=872,248
local sheet=Image(w*4,h,ColorMode.RGB)
sheet:clear()
for f=0,3 do
  local mask={}
  for y=0,h-1 do
    for x=0,w-1 do
      local p=src:getPixel(x+76,f*384+y+108)
      if math.min(pc.rgbaR(p),pc.rgbaG(p),pc.rgbaB(p))>175 then
        mask[y*w+x]=true
      end
    end
  end
  for y=0,h-1 do
    for x=0,w-1 do
      local keep=mask[y*w+x]
      if not keep then
        for dy=-5,5 do
          for dx=-5,5 do
            local xx,yy=x+dx,y+dy
            if dx*dx+dy*dy<=25 and xx>=0 and xx<w and yy>=0 and yy<h
              and mask[yy*w+xx] then keep=true; break end
          end
          if keep then break end
        end
      end
      if keep then sheet:drawPixel(f*w+x,y,src:getPixel(x+76,f*384+y+108)) end
    end
  end
end
sheet:saveAs("assets/cloud-normal-imagegen-sheet.png")
