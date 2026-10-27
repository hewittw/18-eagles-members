# Credits

Every image in `public/` with its source, author, and license.

## Mood board

Files in `public/mood-board/`. Each was resized to at most 1600px and recompressed, and nothing else was
changed except the crops noted below. Images marked CC BY-SA are shared under the same license.

### Collected images

| File | What | Author | License | Source |
|---|---|---|---|---|
| `augusta-leaderboard.jpg` | The hand-operated leaderboard at Augusta National, 2015 | Ryan Schreiber | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0) | https://commons.wikimedia.org/wiki/File:Augusta_National_Leaderboard_(17071936729).jpg |
| `benvenue-scorecard.jpg` | Benvenue Country Club score card (inside), Rocky Mount, N.C. | Unknown; contributed by Braswell Memorial Library via DPLA | Public domain | https://commons.wikimedia.org/wiki/File:Benvenue_Country_Club,_Rocky_Mount,_N.C._Golf_Score_Card_-_DPLA_-_2ee7d8c8e1eb03c2ce2308b51db72e3f_(page_2).jpg |
| `benvenue-scorecard-p1.jpg` | Benvenue Country Club score card (cover, local rules, the 13th hole) | Unknown; contributed by Braswell Memorial Library via DPLA | Public domain | https://commons.wikimedia.org/wiki/File:Benvenue_Country_Club,_Rocky_Mount,_N.C._Golf_Score_Card_-_DPLA_-_2ee7d8c8e1eb03c2ce2308b51db72e3f_(page_1).jpg |
| `lees-the-golfers.jpg` | *The Golfers*, Charles Lees, 1847, oil on canvas, National Galleries of Scotland | Charles Lees | Public domain | https://commons.wikimedia.org/wiki/File:%27The_Golfers%27_by_Charles_Lees,_1847,_oil_on_canvas,_National_Galleries_of_Scotland,_Edinburgh.jpg |
| `pinehurst-4th.jpg` | Postcard: the fourth hole, No. 2 course, Pinehurst, N.C. (Massengill Postcard Collection) | State Archives of North Carolina | [No known copyright restrictions](https://www.flickr.com/commons/usage/) | https://commons.wikimedia.org/wiki/File:4th,_Pinehurst_No_2_001_(22130096452).jpg |
| `shinnecock-1901.jpg` | Shinnecock Hills Golf Club clubhouse, 1901 | Unknown author | Public domain | https://commons.wikimedia.org/wiki/File:Shinnecock_Hills_Golf_Club_-_Clubhouse_(1901).jpg |
| `ra-clubhouse.jpg` | The R&A clubhouse and the Swilcan Burn bridge, St Andrews | Optograph | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) | https://commons.wikimedia.org/wiki/File:R%26A_Clubhouse,_Old_Course,_Swilcan_Burn_bridge_(cropped).jpg |
| `dorgan-locker-room.jpg` | *Indoor Sports: Complimenting the Handicap Committee… in the Locker Room*, before 1930 | Thomas "Tad" Dorgan | Public domain | https://commons.wikimedia.org/wiki/File:Indoor_Sports_-_Complimenting_the_Handicap_Committee_As_You_Give_the_List_the_O.O._in_the_Locker_Room.jpg |
| `rice-house-rsf.jpg` | Lilian Jenette Rice house, Rancho Santa Fe, built 1925 | Jerrye & Roy Klotz, M.D. | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | https://commons.wikimedia.org/wiki/File:LILLAN_JENETTE_RICE_HOUSE,_RANCHO_SANTA_FE_SAN_DIEGO_COUNTY_CA.jpg |
| `jones-1945.jpg` | Augusta National Golf Club membership certificate, 1945, signed by Bobby Jones (Sammlung Commodore) | Julie Ceccaldi (scan) | [CC0 1.0](http://creativecommons.org/publicdomain/zero/1.0/deed.en) | https://commons.wikimedia.org/wiki/File:Augusta_National_Golf_Club_signed_by_Bobby_Jones_1945.jpg |

### Reference screenshots (screenshot, for study)

Captured by us on 2026-10-19 at 1440×900 and cropped to show layout and type only. Every crop leaves out
the site's logo or crest. Copyright stays with the site owners. These are shown on the mood board as
criticism and study and are not used in the app.

| File | Page | Crop |
|---|---|---|
| `shot-rsf-home.jpg` | https://www.rsfgolfclub.com/ (© Rancho Santa Fe Golf Club) | Below the header: hero photo and first heading |
| `shot-rsf-membership.jpg` | https://www.rsfgolfclub.com/guest-information/rsfgc-membership | Below the header: course banner, side nav, heading |
| `shot-masters-leaderboard.jpg` | https://www.masters.com/en_US/scores/index.html (© Augusta National, Inc.) | The leaderboard graphic only |
| `shot-masters-course.jpg` | https://www.masters.com/en_US/course/index.html | Hole cards 1–6, below the nav |
| `shot-masters-hole12.jpg` | https://www.masters.com/en_US/course/hole12.html | Pull-quote and strategy text |

### Generated artifacts (✦)

Everything marked ✦ on the board (scorecard specimen, leaderboard tiles, type specimens, palette, yardage
drawing, nameplate, monogram, textures, sketches) was drawn in code for this project (SVG/CSS in
`src/app/mood-board/`) and is original work. Fonts: Libre Caslon Display and Libre Caslon Text (Pablo Impallari,
SIL OFL 1.1), Barlow and Barlow Condensed (Jeremy Tribby, SIL OFL 1.1), served with `next/font/google`.

## Course photo treatment

The app shows graded copies of the course photos, in `public/courses/<slug>/graded/`, made by
`scripts/grade-photos.mjs`. The originals next to them are kept unchanged, and the table below credits them (a graded
copy has the same file name). Each copy is cropped to 3:2 and resized to at most 1600px wide. Each one also gets one
shared colour grade: levels, a warm white balance, a little more saturation in greens and blues, and a bluer sky where
the original sky was grey. The grade is made with ordinary per-pixel adjustments, and no content is generated or
added. The three vintage postcards (Jackson Park ×2, the Pinehurst No. 2 hero) are only cropped and get levels, with
no sky or colour grade.

- **Licences allow it.** Every course photo is CC BY, CC BY-SA, CC0, public domain, or "no known copyright
  restrictions," and all of these allow changes. **The graded copies are modified versions.** Each one keeps its
  original's author credit and licence. The CC BY-SA ones are shared under the same CC BY-SA licence as their
  originals, and the CC BY ones note that they were changed (cropped and colour-graded).
- **No "All rights reserved" photos are graded.** The two home clubs (Rancho Santa Fe, Fairbanks Ranch) have no photo
  in the course library. They show the drawn illustration, so nothing of theirs was changed.

## Data sources (live APIs, Week 4)

Both are free and keyless, and both are called only from our own server routes (see `docs/apis.md`).

| Source | What we use | License / terms | Attribution shown |
|---|---|---|---|
| [OpenGolfAPI](https://opengolfapi.org/) | Course search, scorecards (par, stroke index, tees with rating and slope, hole yards), course facts (architect, year, grasses, facilities, best months), and the coordinates in `src/data/course-geo.ts` | Data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/); anonymous reads allowed (daily per-IP limit) | “Course data © OpenStreetMap contributors (ODbL 1.0) via OpenGolfAPI”, under course search, course facts, and on every course filled from it (its data notes) |
| [Open-Meteo](https://open-meteo.com/) | Current conditions, the next 12 hours, the 7-day forecast, sunrise and sunset | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); free for non-commercial use, no key | “Weather data by Open-Meteo.com”, under every weather panel, the tee sheet forecast, and a card's “Played in” line |

## Courses

Course photos in `public/courses/<slug>/`, generated from each course's JSON by `scripts/gen-credits.mjs`.
All are freely licensed except where the license says "All rights reserved" (the user's home clubs; see DESIGN_LOG.md).
Courses with no photo show a drawn yardage-book illustration instead.

| Course | File | Author / owner | License | Source |
|---|---|---|---|---|
| Augusta National Golf Club | `hero.jpg` | Mbrooks (Wikimedia Commons) | Public domain | https://commons.wikimedia.org/wiki/File:Augusta_National_Golf_Club,_Hole_10_(Camellia)_-_cropped.jpg |
| Augusta National Golf Club | `g1.jpg` | Florian Fritsch, assisted by Mark Anderson | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:AGNC-12.jpg |
| Augusta National Golf Club | `g2.jpg` | Dan Perry from Atlanta, USA | CC BY 2.0 | https://commons.wikimedia.org/wiki/File:Masters_Tournament_-_2013_-_Eighteenth_hole,_Augusta_National_Golf_Club_(8688527211).jpg |
| Bethpage State Park, Black Course | `hero.jpg` | Bryan Berlin | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Ryder_Cup_2025-163.jpg |
| Bethpage State Park, Black Course | `g1.jpg` | E S Lee | CC BY 2.0 | https://commons.wikimedia.org/wiki/File:Bethpage_Black_Course_warning_sign.jpg |
| Bethpage State Park, Black Course | `g2.jpg` | Bryan Berlin | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Ryder_Cup_2025-218.jpg |
| Carnoustie Golf Links, Championship Course | `hero.jpg` | Jim Smillie | CC BY-SA 2.0 | https://commons.wikimedia.org/wiki/File:18th_Green_Championship_Course-Carnoustie-geograph-4747170-by-Jim-Smillie.jpg |
| Carnoustie Golf Links, Championship Course | `g1.jpg` | Scott Cormie | CC BY-SA 2.0 | https://commons.wikimedia.org/wiki/File:Carnoustie_Championship_Course,_6th_Hole,_Hogan%27s_Alley_-_geograph.org.uk_-_6813696.jpg |
| Chambers Bay | `hero.jpg` | Atomic Taco from Seattle, WA, USA | CC BY-SA 2.0 | https://commons.wikimedia.org/wiki/File:Chambers_Bay_Golf_Course_(17998751820).jpg |
| Chambers Bay | `g1.jpg` | Atomic Taco from Seattle, WA, USA | CC BY-SA 2.0 | https://commons.wikimedia.org/wiki/File:Chambers_Bay_during_the_US_Open_(19067123301).jpg |
| Chambers Bay | `g2.jpg` | Rbirman | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Hickory_Golfer.jpg |
| Fairbanks Ranch Country Club (Valley/Lakes) | (illustration) | n/a | n/a | n/a |
| Harbour Town Golf Links | `hero.jpg` | Dan Perry (danperry.com) | CC BY 2.0 | https://commons.wikimedia.org/wiki/File:Harbour_Town_Golf,_Hilton_Head_-_5111146241.jpg |
| Harbour Town Golf Links | `g1.jpg` | Dan Perry (danperry.com) | CC BY 2.0 | https://commons.wikimedia.org/wiki/File:Harbour_Town_Golf,_Hilton_Head_-_5111137869.jpg |
| Harbour Town Golf Links | `g2.jpg` | Dan Perry (danperry.com) | CC BY 2.0 | https://commons.wikimedia.org/wiki/File:Harbour_Town_Golf_Links,_Hilton_Head_-_5111737496.jpg |
| Jackson Park Golf Course | `hero-park.jpg` | JulDer Wiki | CC BY 4.0 | https://commons.wikimedia.org/wiki/File:Jackson_Park_Chicago_12.jpg |
| Jackson Park Golf Course | `g2.jpg` | Unknown author (Newberry Library postcard collection) | Public domain | https://commons.wikimedia.org/wiki/File:The_Golf_Links,_Jackson_Park,_Chicago_(NBY_416563).jpg |
| Jackson Park Golf Course | `g1.jpg` | Unknown author (Newberry Library postcard collection) | Public domain | https://commons.wikimedia.org/wiki/File:Golf_Shelter,_Jackson_Park,_Chicago_(NBY_417059).jpg |
| Kiawah Island Golf Resort, The Ocean Course | `hero-18th.jpg` | N75746 | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Ocean_course_18th_green.jpg |
| Kiawah Island Golf Resort, The Ocean Course | `g1.jpg` | Pammymags (photo by Tim Marose) | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Kiawah_Island_South_Carolina_-_The_Ocean_Course.jpg |
| Kingsbarns Golf Links | `hero.jpg` | Scott Cormie | CC BY-SA 2.0 | https://commons.wikimedia.org/wiki/File:Kingsbarns_Golf_Links,_2nd_Hole,_Firth_-_geograph.org.uk_-_8163383.jpg |
| Kingsbarns Golf Links | `g1.jpg` | Scott Cormie | CC BY-SA 2.0 | https://commons.wikimedia.org/wiki/File:Kingsbarns_Golf_Links,_18th_Hole,_Cundie_Brig_-_geograph.org.uk_-_8163455.jpg |
| Merion Golf Club, East Course | `hero.jpg` | Michael Stokes | CC BY 2.0 | https://commons.wikimedia.org/wiki/File:2022_Curtis_Cup_-_Bridge_(52139765260).jpg |
| Merion Golf Club, East Course | `g1.jpg` | Bert Stewart | Public domain | https://commons.wikimedia.org/wiki/File:HoganMerion.jpg |
| Merion Golf Club, East Course | `g2.jpg` | Michael Stokes | CC BY 2.0 | https://commons.wikimedia.org/wiki/File:2022_Curtis_Cup_-_5th_Green_(52139279501).jpg |
| Muirfield (The Honourable Company of Edinburgh Golfers) | `hero.jpg` | alljengi | CC BY-SA 2.0 | https://commons.wikimedia.org/wiki/File:18th_Hole_at_Muirfield,_The_Open_2013_.jpg |
| Muirfield (The Honourable Company of Edinburgh Golfers) | `g1.jpg` | Richard Webb | CC BY-SA 2.0 | https://commons.wikimedia.org/wiki/File:Muirfield_golf_course_seen_from_Gullane_Hill_-geograph-5989355-by-Richard-Webb.jpg |
| North Berwick Golf Club, West Links | `hero.jpg` | Robertaleotta2020 | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:North_Berwick_West_Links.jpg |
| North Berwick Golf Club, West Links | `g1.jpg` | Stuart Shepherd | CC BY-SA 2.0 | https://commons.wikimedia.org/wiki/File:West_Links_Golf_Course,_North_Berwick_(18th_Green)_-_geograph.org.uk_-_4596095.jpg |
| Oakmont Country Club | `hero.jpg` | Lee Paxton | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:OakmontCountryClub.jpg |
| The Olympic Club, Lake Course | `hero.jpg` | Lisa Suender | CC BY-SA 2.0 | https://commons.wikimedia.org/wiki/File:US_Open_2012_-_Olympic_Club_Golf_Course_(7181767803).jpg |
| The Olympic Club, Lake Course | `g1.jpg` | Thomas Hawk | CC BY 2.0 | https://commons.wikimedia.org/wiki/File:Olympic_Club_18th_hole_lakeside.jpg |
| The Olympic Club, Lake Course | `g2.jpg` | Lisa Suender | CC BY-SA 2.0 | https://commons.wikimedia.org/wiki/File:US_Open_2012_-_Narrow_fairways_at_Olympic_Course_(7181768113).jpg |
| Pebble Beach Golf Links | `hero.jpg` | Bernard Gagnon | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Pebble_Beach_18th_hole.jpg |
| Pebble Beach Golf Links | `g1.jpg` | Metallion | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Pebble_Beach_Golf_Links,_hole_7.jpg |
| Pebble Beach Golf Links | `g2.jpg` | Bernard Gagnon | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Pebble_Beach_6th_hole.jpg |
| Pinehurst No. 2 | `hero-sign.jpg` | Zhans33 | Public domain | https://commons.wikimedia.org/wiki/File:Pinehurst_No._2.JPG |
| Pinehurst No. 2 | `g2.jpg` | State Archives of North Carolina (Massengill Postcard Collection) | No known copyright restrictions | https://commons.wikimedia.org/wiki/File:4th,_Pinehurst_No_2_001_(22130096452).jpg |
| Rancho Santa Fe Golf Club | (illustration) | n/a | n/a | n/a |
| The Riviera Country Club | `hero-18th.jpg` | Dan (golfpro1) from Schaumburg, IL, USA | CC BY 2.0 | https://commons.wikimedia.org/wiki/File:RivieraCountryClub18th.jpg |
| The Riviera Country Club | `g2.jpg` | Dan Perry from Chicago, USA | CC BY 2.0 | https://commons.wikimedia.org/wiki/File:Riviera_Country_Club,_Golf_Course_in_Pacific_Palisades,_California_(168829105).jpg |
| The Riviera Country Club | `g3.jpg` | Benoît Prieur | CC0 | https://commons.wikimedia.org/wiki/File:Aerial_view_of_Riviera_Country_Club_(Pacific_Palisades)_July_2022.jpg |
| Royal Dornoch Golf Club, Championship Course | `hero.jpg` | Julian Paren | CC BY-SA 2.0 | https://commons.wikimedia.org/wiki/File:Fairway_and_bunkers_of_the_Royal_Dornoch_Golf_Links_-_geograph.org.uk_-_8272250.jpg |
| Royal Dornoch Golf Club, Championship Course | `g1.jpg` | Craig Wallace | CC BY-SA 2.0 | https://commons.wikimedia.org/wiki/File:Royal_Dornoch_Golf_Club_-_geograph.org.uk_-_7273513.jpg |
| Royal Dornoch Golf Club, Championship Course | `g2.jpg` | David Dixon | CC BY-SA 2.0 | https://commons.wikimedia.org/wiki/File:Royal_Dornoch_Golf_Club,_Dornoch_Links_-_geograph.org.uk_-_8078986.jpg |
| Royal Troon Golf Club, Old Course | `hero.jpg` | dave souza | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Royal_Troon,_looking_south_with_Clyde_on_right.jpg |
| Royal Troon Golf Club, Old Course | `g1.jpg` | Billy McCrorie | CC BY-SA 2.0 | https://commons.wikimedia.org/wiki/File:Royal_Troon_Golf_Courses_-_geograph.org.uk_-_3829859.jpg |
| Royal Troon Golf Club, Old Course | `g2.jpg` | Alan Reid | CC BY-SA 2.0 | https://commons.wikimedia.org/wiki/File:Daybreak_at_Royal_Troon_Golf_Club_-_geograph.org.uk_-_7028729.jpg |
| Shinnecock Hills Golf Club | `hero.jpg` | Peetlesnumber1 | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Shinnecock_Hills_GC_03.jpg |
| Shinnecock Hills Golf Club | `g1.jpg` | Peetlesnumber1 | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Shinnecock_Hills_GC_02.jpg |
| Shinnecock Hills Golf Club | `g2.jpg` | Michael O'Connor | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Shinnecock_Hills_Clubhouse_2021.jpg |
| The Old Course, St Andrews | `hero.jpg` | Iain Cameron | CC BY 2.0 | https://commons.wikimedia.org/wiki/File:The_18th_(Tom_Morris)_Hole_on_the_Old_Course_(St_Andrews).jpg |
| The Old Course, St Andrews | `g1.jpg` | Scott Cormie | CC BY-SA 2.0 | https://commons.wikimedia.org/wiki/File:St.Andrews_Old_Course,_17th_Hole,_Road_-_geograph.org.uk_-_5515227.jpg |
| The Old Course, St Andrews | `g2.jpg` | Scott Cormie | CC BY-SA 2.0 | https://commons.wikimedia.org/wiki/File:St.Andrews_Old_Course,_12th_Hole,_Heathery_in_(geograph_5515174).jpg |
| Torrey Pines Golf Course, North Course | `hero.jpg` | Bernard Gagnon | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Torrey_Pines_North_Course_First_hole.jpg |
| Torrey Pines Golf Course, North Course | `g1.jpg` | Bernard Gagnon | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Torrey_Pines_Golf_Course_clubhouse.jpg |
| Torrey Pines Golf Course, South Course | `hero.jpg` | Flash and Mel from San Diego, CA, USA | CC BY-SA 2.0 | https://commons.wikimedia.org/wiki/File:US_Open_-_2008_-_The_3rd_hole_green_with_La_Jolla_in_the_background_(2578252099).jpg |
| Torrey Pines Golf Course, South Course | `g1.jpg` | Dirk DBQ | CC BY 2.0 | https://commons.wikimedia.org/wiki/File:US_Open_-_2008_-_Panorama_-18_at_Torrey_Pines_(2578787934).jpg |
| TPC Sawgrass, THE PLAYERS Stadium Course | `hero.jpg` | Craig ONeal | CC BY-SA 2.0 | https://commons.wikimedia.org/wiki/File:TPC_Sawgrass_17.jpg |
| TPC Sawgrass, THE PLAYERS Stadium Course | `g1.jpg` | St. Johns County Visitors & Conventions Bureau | Public domain | https://commons.wikimedia.org/wiki/File:TournamentPlayersClub_Sawgrass17thHole.jpg |
| TPC Sawgrass, THE PLAYERS Stadium Course | `g2.jpg` | Philip Larson from McLean, VA, US | CC BY-SA 2.0 | https://commons.wikimedia.org/wiki/File:TPC_at_Sawgrass_(3423941155).jpg |
| Turnberry, Ailsa Course | `hero-green.jpg` | Walter Baxter (Geograph) | CC BY-SA 2.0 | https://commons.wikimedia.org/wiki/File:Trump_Turnberry_Ailsa_Golf_Course_-_geograph.org.uk_-_6162985.jpg |
| Turnberry, Ailsa Course | `g1.jpg` | easylocum | CC BY 2.0 | https://commons.wikimedia.org/wiki/File:Turnberry_(Ailsa_course)_Holes_10_and_12.jpg |
| Turnberry, Ailsa Course | `g2.jpg` | Ian Dick | CC BY 2.0 | https://commons.wikimedia.org/wiki/File:Turnberry_Lighthouse_(29972057257).jpg |
| Whistling Straits, Straits Course | `hero.jpg` | Specialkboyle | Public domain | https://commons.wikimedia.org/wiki/File:Whistling_Straits_golf_course,_far_shot.jpg |
| Whistling Straits, Straits Course | `g1.jpg` | Baybay1901 | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:WhistlingStraits-Shoreline-Par5.jpg |
| Whistling Straits, Straits Course | `g2.jpg` | KevinTR | Public domain | https://commons.wikimedia.org/wiki/File:WhistlingStraits11Fairway.JPG |
| Winged Foot Golf Club, West Course | `hero.jpg` | juan gomez (jgomez20), via Unsplash | CC0 | https://commons.wikimedia.org/wiki/File:Mamaroneck_golf_club_(Unsplash).jpg |
| Winged Foot Golf Club, West Course | `g1.jpg` | Anthony22 (English Wikipedia) | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Winged_Foot_Golf_Club_main_entrance.jpg |

## Research

App screenshots in `public/research/<app>/` are store listing images, used as screenshot, for study. Sources are listed in each study in `docs/research/`.
