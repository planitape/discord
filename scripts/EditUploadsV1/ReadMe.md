# EditUploadsV1

Edit Uploads before sending. 

this is a **browser console script** for native Discord Web.  
Paste it into DevTools Console, it adds image editor option.


- Works only on **Discord Web**.  
- **Console script only** — not a plugin, not an extension.  
- Private & client side: works on native website even if its offline, local, no API, no dependancies.   


### Editor UI  
<img width="1950" height="1338" alt="image" src="https://github.com/user-attachments/assets/3b323f68-26ee-42dc-aa3f-7b0699cb240c" />


### Edit button in chat image view  
<img width="446" height="150" alt="image" src="https://github.com/user-attachments/assets/0c5fcca6-a745-44be-aff2-7a3a6a34a9ac" />


### Edit button in chat attachment  
<img width="412" height="464" alt="image" src="https://github.com/user-attachments/assets/07b9f537-24a6-4883-b83c-ea3107e2b503" />

 
---

## 🔒 How It Works
- Runs only in **your browser**, nothing external.  
- Adds an **Edit Upload (EU)** button on images and attachments.  
- Loads the image into a `<canvas>` → this instantly **wipes all EXIF / metadata**.  
- You edit locally (brush, crop, blur, text, etc.) and save.  
- The clean PNG is dropped back into Discord’s chat box like a normal upload.  
- 100% local client-side — no API, no servers, no AI.  

---

## 🚀 Usage
1. Open Discord in your browser.  
2. Press **F12** → go to **Console**.  
3. Paste the `EditUploadsV1.js` code → press Enter.  
4. You’ll see `EditUploadsV1 loaded` in console.  
5. will last forever until you reload page. 


Now you can:  
- Click **Edit Upload (EU)** on images or attachments.  
- Use the **launcher near Help** for a blank canvas.  
- Paste an image (`Ctrl+V`) to edit instantly.  

---

## ✨ Features
- Brush, Eraser, Arrows, Rect / Circle, Text & Emoji  
- Crop with glowing feedback  
- Blur & Inverse Blur brushes  
- Undo / Redo / Reset  
- Rename file, resolution & file size display  
- Save (queue), Send (instant), Remove (queue), Download PNG  
- RGB glowing border effect  
- **EXIF / metadata always stripped**  

---

## 📝 Notes
- Port to BD/Ven   

---

**Support / Invite:** https://discord.gg/SADyYHbWn5
