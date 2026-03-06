import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db: any;

async function startServer() {
  console.log(">>> SERVER STARTING UP...");
  
  try {
    const dbPath = path.join(__dirname, "rangtelier.db");
    console.log(`>>> Initializing database at: ${dbPath}`);
    db = new Database(dbPath);
    
    // Initialize database tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS nail_elements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        name TEXT NOT NULL,
        value TEXT,
        image_url TEXT
      );

      CREATE TABLE IF NOT EXISTS category_triggers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trigger_category TEXT NOT NULL,
        trigger_value TEXT NOT NULL,
        target_category TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS result_images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        combination_json TEXT NOT NULL,
        image_url TEXT NOT NULL
      );
    `);
    console.log(">>> Database tables initialized.");

    // One-time migration for Parts
    const hasPartsYN = db.prepare("SELECT count(*) as count FROM nail_elements WHERE category = 'parts_yn'").get() as { count: number };
    if (hasPartsYN.count === 0) {
      // 1. Rename old 'parts' to 'parts_detail'
      db.prepare("UPDATE nail_elements SET category = 'parts_detail' WHERE category = 'parts'").run();
      
      // 2. Add 'parts_yn' elements
      const insert = db.prepare("INSERT INTO nail_elements (category, name, value) VALUES (?, ?, ?)");
      insert.run('parts_yn', '있음', 'Yes');
      insert.run('parts_yn', '없음', 'No');
      
      // 3. Add trigger: parts_yn '있음' -> parts_detail
      db.prepare("INSERT INTO category_triggers (trigger_category, trigger_value, target_category) VALUES (?, ?, ?)").run('parts_yn', '있음', 'parts_detail');
      
      console.log(">>> Parts migration completed.");
    }

    // Migration for "Both hands different" triggers
    const hasLRTriggers = db.prepare("SELECT count(*) as count FROM category_triggers WHERE trigger_category = 'lr_style'").get() as { count: number };
    if (hasLRTriggers.count === 0) {
      const insertTrigger = db.prepare("INSERT INTO category_triggers (trigger_category, trigger_value, target_category) VALUES (?, ?, ?)");
      insertTrigger.run('lr_style', '비대칭 (언밸런스)', 'base_color_right');
      insertTrigger.run('lr_style', '비대칭 (언밸런스)', 'point_color_right');
      insertTrigger.run('lr_style', '비대칭 (언밸런스)', 'design_right');
      console.log(">>> LR Style triggers added.");
    }

    // Sync point_color to point_color_right
    const pointColorsToSync = [
      { name: '실버', value: '#C0C0C0' },
      { name: '골드', value: '#D4AF37' },
      { name: '버건디', value: '#800020' },
      { name: '블랙', value: '#000000' },
      { name: '화이트', value: '#FFFFFF' },
      { name: '분홍', value: '#FFC0CB' },
      { name: '보라', value: '#800080' },
      { name: '초록', value: '#008000' },
      { name: '연두', value: '#90EE90' },
      { name: '파랑', value: '#0000FF' },
      { name: '남색', value: '#000080' },
      { name: '하늘', value: '#87CEEB' },
      { name: '노랑', value: '#FFFF00' },
      { name: '연노랑', value: '#FFFFE0' },
      { name: '체리색', value: '#D2042D' },
      { name: '로즈 골드', value: '#B76E79' },
      { name: '에메랄드', value: '#50C878' },
      { name: '핫핑크', value: '#FF69B4' },
      { name: '터쿼이즈', value: '#40E0D0' },
      { name: '오렌지', value: '#FFA500' }
    ];

    pointColorsToSync.forEach(color => {
      // Add to main point_color if not exists
      const existsMain = db.prepare("SELECT id FROM nail_elements WHERE category = 'point_color' AND name = ?").get(color.name);
      if (!existsMain) {
        db.prepare("INSERT INTO nail_elements (category, name, value) VALUES (?, ?, ?)").run('point_color', color.name, color.value);
      }
      // Add to point_color_right if not exists
      const existsRight = db.prepare("SELECT id FROM nail_elements WHERE category = 'point_color_right' AND name = ?").get(color.name);
      if (!existsRight) {
        db.prepare("INSERT INTO nail_elements (category, name, value) VALUES (?, ?, ?)").run('point_color_right', color.name, color.value);
      }
    });

    // Sync base_color to base_color_right
    const baseColors = db.prepare("SELECT name, value FROM nail_elements WHERE category = 'base_color'").all() as { name: string, value: string }[];
    baseColors.forEach(color => {
      const exists = db.prepare("SELECT id FROM nail_elements WHERE category = 'base_color_right' AND name = ?").get(color.name);
      if (!exists) {
        db.prepare("INSERT INTO nail_elements (category, name, value) VALUES (?, ?, ?)").run('base_color_right', color.name, color.value);
      }
    });
    
    // Sync point_color to point_color_right
    const pointColors = db.prepare("SELECT name, value FROM nail_elements WHERE category = 'point_color'").all() as { name: string, value: string }[];
    pointColors.forEach(color => {
      const exists = db.prepare("SELECT id FROM nail_elements WHERE category = 'point_color_right' AND name = ?").get(color.name);
      if (!exists) {
        db.prepare("INSERT INTO nail_elements (category, name, value) VALUES (?, ?, ?)").run('point_color_right', color.name, color.value);
      }
    });

    // Sync design to design_right
    const designs = db.prepare("SELECT name, value FROM nail_elements WHERE category = 'design'").all() as { name: string, value: string }[];
    designs.forEach(design => {
      const exists = db.prepare("SELECT id FROM nail_elements WHERE category = 'design_right' AND name = ?").get(design.name);
      if (!exists) {
        db.prepare("INSERT INTO nail_elements (category, name, value) VALUES (?, ?, ?)").run('design_right', design.name, design.value);
      }
    });
    
    console.log(">>> Syncing categories for additional hand completed.");

    // One-time refresh for the new triggers table
    const hasTriggersTable = db.prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='category_triggers'").get() as { count: number };
    if (hasTriggersTable.count === 0) {
      // Seed some initial triggers based on user request
      const insertTrigger = db.prepare("INSERT INTO category_triggers (trigger_category, trigger_value, target_category) VALUES (?, ?, ?)");
      insertTrigger.run('design', '자석젤', 'magnet_pattern');
      insertTrigger.run('design', '캐릭터네일', 'character');
      
      // Ensure '캐릭터네일' exists in design
      const hasCharNail = db.prepare("SELECT * FROM nail_elements WHERE category = 'design' AND name = '캐릭터네일'").get();
      if (!hasCharNail) {
        db.prepare("INSERT INTO nail_elements (category, name, value) VALUES (?, ?, ?)").run('design', '캐릭터네일', 'Character Nail');
      }
    }

    // Seed initial data if empty
    const count = db.prepare("SELECT COUNT(*) as count FROM nail_elements").get() as { count: number };
    if (count.count === 0) {
      const insert = db.prepare("INSERT INTO nail_elements (category, name, value) VALUES (?, ?, ?)");
      
      // 1. 길이 (Length)
      insert.run('length', '숏 (Short)', 'Short');
      insert.run('length', '미디엄 (Medium)', 'Medium');
      insert.run('length', '롱 (Long)', 'Long');
      
      // 2. 쉐입 (Shape)
      insert.run('shape', '오발', 'Oval');
      insert.run('shape', '스퀘어', 'Square');
      insert.run('shape', '아몬드', 'Almond');
      
      // 3. 디자인 (Design)
      insert.run('design', '자석젤', 'Magnet Gel');
      insert.run('design', '시럽 네일', 'Syrup');
      insert.run('design', '치크 네일', 'Cheek');
      insert.run('design', '드로잉', 'Drawing');
      
      // 4. 자석젤 패턴 (Magnet Pattern)
      insert.run('magnet_pattern', '하트 패턴', 'Heart');
      insert.run('magnet_pattern', '사선 패턴', 'Diagonal');
      insert.run('magnet_pattern', '원형 패턴', 'Circle');
      
      // 5. 컬러톤 (Color Tone)
      insert.run('color_tone', '웜톤', 'Warm');
      insert.run('color_tone', '쿨톤', 'Cool');
      insert.run('color_tone', '뉴트럴', 'Neutral');
      
      // 6. 아트스타일 (Art Style)
      insert.run('art_style', 'Y2K', 'Y2K');
      insert.run('art_style', '발레코어', 'Balletcore');
      insert.run('art_style', '오피스코어', 'Officecore');
      
      // 7. 좌우스타일 (LR Style)
      insert.run('lr_style', '대칭', 'Symmetric');
      insert.run('lr_style', '비대칭 (언밸런스)', 'Asymmetric');
      
      // 8. 베이스 컬러 (Base Color)
      insert.run('base_color', '밀키 화이트', '#F5F5F5');
      insert.run('base_color', '크림 베이지', '#F5F5DC');
      insert.run('base_color', '베이비 핑크', '#F4C2C2');
      insert.run('base_color', '피치 코랄', '#FF9A8A');
      insert.run('base_color', '라벤더', '#E6E6FA');
      insert.run('base_color', '민트', '#B2FFFF');
      insert.run('base_color', '스카이블루', '#87CEEB');
      insert.run('base_color', '투명 클리어', 'transparent');
      insert.run('base_color', '아이보리', '#FFFFF0');
      insert.run('base_color', '코랄 핑크', '#F88379');
      insert.run('base_color', '버터 옐로우', '#FFFD74');
      insert.run('base_color', '소프트 그레이', '#D3D3D3');
      insert.run('base_color', '누드 베이지', '#E3C1B4');
      insert.run('base_color', '더스티 로즈', '#BA7E7E');
      insert.run('base_color', '세이지 그린', '#9C9F84');
      insert.run('base_color', '모브', '#E0B0FF');
      
      // Right hand versions for "Both hands different"
      insert.run('base_color_right', '밀키 화이트', '#F5F5F5');
      insert.run('base_color_right', '크림 베이지', '#F5F5DC');
      insert.run('base_color_right', '베이비 핑크', '#F4C2C2');
      insert.run('base_color_right', '피치 코랄', '#FF9A8A');
      insert.run('base_color_right', '라벤더', '#E6E6FA');
      insert.run('base_color_right', '민트', '#B2FFFF');
      insert.run('base_color_right', '스카이블루', '#87CEEB');
      insert.run('base_color_right', '투명 클리어', 'transparent');
      insert.run('base_color_right', '아이보리', '#FFFFF0');
      insert.run('base_color_right', '코랄 핑크', '#F88379');
      insert.run('base_color_right', '버터 옐로우', '#FFFD74');
      insert.run('base_color_right', '소프트 그레이', '#D3D3D3');
      insert.run('base_color_right', '누드 베이지', '#E3C1B4');

      // 9. 포인트 컬러 (Point Color)
      insert.run('point_color', '실버', '#C0C0C0');
      insert.run('point_color', '골드', '#D4AF37');
      insert.run('point_color', '버건디', '#800020');
      insert.run('point_color', '블랙', '#000000');
      insert.run('point_color', '화이트', '#FFFFFF');
      insert.run('point_color', '분홍', '#FFC0CB');
      insert.run('point_color', '보라', '#800080');
      insert.run('point_color', '초록', '#008000');
      insert.run('point_color', '연두', '#90EE90');
      insert.run('point_color', '파랑', '#0000FF');
      insert.run('point_color', '남색', '#000080');
      insert.run('point_color', '하늘', '#87CEEB');
      insert.run('point_color', '노랑', '#FFFF00');
      insert.run('point_color', '연노랑', '#FFFFE0');
      insert.run('point_color', '체리색', '#D2042D');
      insert.run('point_color', '로즈 골드', '#B76E79');
      insert.run('point_color', '에메랄드', '#50C878');
      insert.run('point_color', '핫핑크', '#FF69B4');
      insert.run('point_color', '터쿼이즈', '#40E0D0');
      insert.run('point_color', '오렌지', '#FFA500');
      
      insert.run('point_color_right', '실버', '#C0C0C0');
      insert.run('point_color_right', '골드', '#D4AF37');
      insert.run('point_color_right', '버건디', '#800020');
      insert.run('point_color_right', '블랙', '#000000');
      insert.run('point_color_right', '화이트', '#FFFFFF');
      insert.run('point_color_right', '분홍', '#FFC0CB');
      insert.run('point_color_right', '보라', '#800080');
      insert.run('point_color_right', '초록', '#008000');
      insert.run('point_color_right', '연두', '#90EE90');
      insert.run('point_color_right', '파랑', '#0000FF');
      insert.run('point_color_right', '남색', '#000080');
      insert.run('point_color_right', '하늘', '#87CEEB');
      insert.run('point_color_right', '노랑', '#FFFF00');
      insert.run('point_color_right', '연노랑', '#FFFFE0');
      insert.run('point_color_right', '체리색', '#D2042D');
      insert.run('point_color_right', '로즈 골드', '#B76E79');
      insert.run('point_color_right', '에메랄드', '#50C878');
      insert.run('point_color_right', '핫핑크', '#FF69B4');
      insert.run('point_color_right', '터쿼이즈', '#40E0D0');
      insert.run('point_color_right', '오렌지', '#FFA500');

      // Right hand design
      insert.run('design_right', '자석젤', 'Magnet Gel');
      insert.run('design_right', '시럽 네일', 'Syrup');
      insert.run('design_right', '치크 네일', 'Cheek');
      insert.run('design_right', '드로잉', 'Drawing');
      insert.run('design_right', '캐릭터네일', 'Character Nail');
      
      // 10. 파츠 유무 (Parts YN)
      insert.run('parts_yn', '있음', 'Yes');
      insert.run('parts_yn', '없음', 'No');

      // 10-1. 파츠 종류 (Parts Detail)
      insert.run('parts_detail', '진주 (Pearl)', 'Pearl');
      insert.run('parts_detail', '리본 (Ribbon)', 'Ribbon');
      insert.run('parts_detail', '하트 (Heart)', 'Heart');
      insert.run('parts_detail', '별 (Star)', 'Star');
      insert.run('parts_detail', '크리스탈 스톤 (Crystal)', 'Crystal');
      insert.run('parts_detail', '캐릭터 파츠', 'Character');
      insert.run('parts_detail', '꽃 파츠 (Flower)', 'Flower');
      insert.run('parts_detail', '나비 (Butterfly)', 'Butterfly');
      insert.run('parts_detail', '체인 (Chain)', 'Chain');
      insert.run('parts_detail', '샤넬 (Chanel)', 'Chanel');
      insert.run('parts_detail', '루이비통 (Louis Vuitton)', 'Louis Vuitton');
      insert.run('parts_detail', '입생로랑 (YSL)', 'YSL');
      insert.run('parts_detail', '펜디 (Fendi)', 'Fendi');
      insert.run('parts_detail', '비비안 웨스트우드 (Vivienne)', 'Vivienne');
      insert.run('parts_detail', '구찌 (Gucci)', 'Gucci');
      
      // 11. 포인트 배치 (Point Placement)
      insert.run('point_placement', '엄지 포인트', 'Thumb');
      insert.run('point_placement', '약지 포인트', 'Ring Finger');
      
      // 12. 마감 (Finish)
      insert.run('finish', '유광 (Glossy)', 'Glossy');
      insert.run('finish', '무광 (Matte)', 'Matte');
      
      // 13. 무드 (Mood)
      insert.run('mood', '러블리', 'Lovely');
      insert.run('mood', '힙한', 'Hip');
      
      // 14. 캐릭터 (Character)
      insert.run('character', '산리오', 'Sanrio');
      insert.run('character', '치이카와', 'Chiikawa');
      insert.run('character', '없음', 'None');
      
      // 15. 브랜드 (Brand) - Hidden from UI but available in DB
      insert.run('brand', '오호라 (Ohora)', 'Ohora');
      insert.run('brand', '데싱디바 (Dashing Diva)', 'Dashing Diva');
      insert.run('brand', '핑거수트 (Finger Suit)', 'Finger Suit');
      insert.run('brand', '엣지유 (EdgeU)', 'EdgeU');

      // 16. 컨셉 (Concept)
      insert.run('concept', '빈티지', 'Vintage');
      insert.run('concept', '키치', 'Kitsch');
      insert.run('concept', '미니멀', 'Minimal');
      insert.run('concept', '화려한', 'Fancy');
      insert.run('concept', '우아한', 'Elegant');
    }

    // Add brand/concept elements if they don't exist (for existing databases)
    const hasBrand = db.prepare("SELECT count(*) as count FROM nail_elements WHERE category = 'brand'").get() as { count: number };
    if (hasBrand.count === 0) {
      const insert = db.prepare("INSERT INTO nail_elements (category, name, value) VALUES (?, ?, ?)");
      insert.run('brand', '오호라 (Ohora)', 'Ohora');
      insert.run('brand', '데싱디바 (Dashing Diva)', 'Dashing Diva');
      insert.run('brand', '핑거수트 (Finger Suit)', 'Finger Suit');
      insert.run('brand', '엣지유 (EdgeU)', 'EdgeU');
    }

    const hasConcept = db.prepare("SELECT count(*) as count FROM nail_elements WHERE category = 'concept'").get() as { count: number };
    if (hasConcept.count === 0) {
      const insert = db.prepare("INSERT INTO nail_elements (category, name, value) VALUES (?, ?, ?)");
      insert.run('concept', '빈티지', 'Vintage');
      insert.run('concept', '키치', 'Kitsch');
      insert.run('concept', '미니멀', 'Minimal');
      insert.run('concept', '화려한', 'Fancy');
      insert.run('concept', '우아한', 'Elegant');
    }
    console.log(">>> Data seeding checked.");
  } catch (err) {
    console.error(">>> INITIALIZATION ERROR:", err);
  }

  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check at the very top
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      env: process.env.NODE_ENV,
      time: new Date().toISOString()
    });
  });

  app.get("/ping", (req, res) => res.send("pong"));

  // Debug log for environment
  console.log(`>>> NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`>>> Current directory: ${process.cwd()}`);
  console.log(`>>> __dirname: ${__dirname}`);

  // API Routes
  app.get("/api/elements", (req, res) => {
    const elements = db.prepare("SELECT * FROM nail_elements").all();
    res.json(elements);
  });

  app.post("/api/elements", (req, res) => {
    const { category, name, value, image_url } = req.body;
    const info = db.prepare("INSERT INTO nail_elements (category, name, value, image_url) VALUES (?, ?, ?, ?)").run(category, name, value, image_url);
    res.json({ id: info.lastInsertRowid });
  });

  app.delete("/api/elements/:id", (req, res) => {
    db.prepare("DELETE FROM nail_elements WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.put("/api/elements/:id", (req, res) => {
    const { category, name, value, image_url } = req.body;
    db.prepare("UPDATE nail_elements SET category = ?, name = ?, value = ?, image_url = ? WHERE id = ?").run(category, name, value, image_url, req.params.id);
    res.json({ success: true });
  });

  // Trigger Routes
  app.get("/api/triggers", (req, res) => {
    const triggers = db.prepare("SELECT * FROM category_triggers").all();
    res.json(triggers);
  });

  app.post("/api/triggers", (req, res) => {
    const { trigger_category, trigger_value, target_category } = req.body;
    const info = db.prepare("INSERT INTO category_triggers (trigger_category, trigger_value, target_category) VALUES (?, ?, ?)").run(trigger_category, trigger_value, target_category);
    res.json({ id: info.lastInsertRowid });
  });

  app.delete("/api/triggers/:id", (req, res) => {
    db.prepare("DELETE FROM category_triggers WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/random", (req, res) => {
    const requestedCategories = req.query.categories ? (req.query.categories as string).split(',') : ['length', 'shape', 'design', 'base_color', 'parts', 'finish'];
    const result: any = {};
    const processedCategories = new Set(requestedCategories);
    
    // Initial pick
    requestedCategories.forEach(cat => {
      const element = db.prepare("SELECT * FROM nail_elements WHERE category = ? ORDER BY RANDOM() LIMIT 1").get(cat);
      if (element) result[cat] = element;
    });

    // Dynamic Triggers Logic
    let changed = true;
    while (changed) {
      changed = false;
      const currentElements = Object.values(result) as any[];
      
      for (const el of currentElements) {
        const triggers = db.prepare("SELECT * FROM category_triggers WHERE trigger_category = ? AND trigger_value = ?").all(el.category, el.name) as any[];
        
        for (const trigger of triggers) {
          if (!result[trigger.target_category]) {
            const targetEl = db.prepare("SELECT * FROM nail_elements WHERE category = ? ORDER BY RANDOM() LIMIT 1").get(trigger.target_category);
            if (targetEl) {
              result[trigger.target_category] = targetEl;
              changed = true; // New element might trigger more elements
            }
          }
        }
      }
    }
    
    res.json(result);
  });

  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      env: process.env.NODE_ENV,
      cwd: process.cwd(),
      dirname: __dirname,
      distExists: fs.existsSync(path.resolve(__dirname, "dist")),
      indexExists: fs.existsSync(path.resolve(__dirname, "dist", "index.html"))
    });
  });

  // Vite middleware or Static serving
  const distPath = path.resolve(__dirname, "dist");
  const hasBuild = fs.existsSync(path.join(distPath, "index.html"));
  const isDev = process.env.NODE_ENV === "development";

  if (isDev && !hasBuild) {
    console.log("Running in DEVELOPMENT mode with Vite...");
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } catch (e) {
      console.error("Vite failed to start, falling back to static serving", e);
      serveStatic(app, distPath);
    }
  } else {
    console.log("Running in PRODUCTION/STATIC mode");
    serveStatic(app, distPath);
  }

  app.get("/api/result-images", (req, res) => {
  const images = db.prepare("SELECT * FROM result_images").all();
  res.json(images);
});

app.post("/api/result-images", express.json(), (req, res) => {
  const { combination_json, image_url } = req.body;
  const info = db.prepare("INSERT INTO result_images (combination_json, image_url) VALUES (?, ?)").run(combination_json, image_url);
  res.json({ id: info.lastInsertRowid });
});

app.delete("/api/result-images/:id", (req, res) => {
  db.prepare("DELETE FROM result_images WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

function serveStatic(app: express.Application, distPath: string) {
  console.log(`Serving static files from: ${distPath}`);
  
  app.use(express.static(distPath));
  
  app.get("*", (req, res) => {
    // Skip API routes
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: "API route not found" });
    }
    
    const indexPath = path.resolve(distPath, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send(`
        <h1>404 - Build Not Found</h1>
        <p>The application is running but the build files are missing.</p>
        <p>Please run 'npm run build' first.</p>
      `);
    }
  });
}

startServer();
