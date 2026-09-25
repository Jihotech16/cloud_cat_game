-- Normalize already-transparent ImageGen cutouts; never redraw/remove pixels by color.
local root=app.params['root'] or 'resources/reward-cards/v3/'
local ids={'jump','charge','chargeCap','orbValue','feather','slowmo','bigcloud','coinBonus','magnet','doubleJump','scoreMul','scoreX2','rocket','shield','trFrenzy','trGlass','trGreed','trRush','legMagnet','legHazard','legShock','legRocket','legFeather'}
if app.params['ids'] then
  ids={}
  for id in string.gmatch(app.params['ids'],'[^,]+') do table.insert(ids,id) end
end
local function bounds(img)
  local l,t,r,b=img.width,img.height,-1,-1
  local transparent=0
  for y=0,img.height-1 do for x=0,img.width-1 do
    local a=app.pixelColor.rgbaA(img:getPixel(x,y))
    if a==0 then transparent=transparent+1 end
    if a>=128 then l=math.min(l,x);r=math.max(r,x);t=math.min(t,y);b=math.max(b,y) end
  end end
  return l,t,r,b,transparent
end
for _,id in ipairs(ids) do
  local path=root..'source/'..id..'-card.png'
  local src=Image{fromFile=path}
  local l,t,r,b,clear=bounds(src)
  assert(clear/(src.width*src.height)>.025,id..': missing transparent background')
  for _,p in ipairs({{0,0},{src.width-1,0},{0,src.height-1},{src.width-1,src.height-1}}) do
    assert(app.pixelColor.rgbaA(src:getPixel(p[1],p[2]))==0,id..': opaque corner')
  end
  for _,scale in ipairs({1,2}) do
    local w,h=512/scale,768/scale
    local dx,dy=16/scale,24/scale
    local dw,dh=480/scale,720/scale
    local out=Image(w,h,ColorMode.RGB);out:clear()
    for y=0,dh-1 do for x=0,dw-1 do
      local sx=l+math.floor(x*(r-l)/(dw-1)+.5)
      local sy=t+math.floor(y*(b-t)/(dh-1)+.5)
      out:drawPixel(dx+x,dy+y,src:getPixel(sx,sy))
    end end
    local ol,ot,orr,ob=bounds(out)
    assert(ol==dx and ot==dy and orr==dx+dw-1 and ob==dy+dh-1,id..': normalized bounds mismatch')
    out:saveAs(root..(scale==1 and '' or 'runtime/')..id..'-card.png')
  end
  print(id..': alpha OK; 512x768 bounds16,24,480,720; runtime256x384 bounds8,12,240,360')
end
