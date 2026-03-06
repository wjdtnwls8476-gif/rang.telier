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

    // Migration for art_style triggers
    const hasArtStyleTriggers = db.prepare("SELECT count(*) as count FROM category_triggers WHERE target_category = 'art_style'").get() as { count: number };
    if (hasArtStyleTriggers.count === 0) {
      const insertTrigger = db.prepare("INSERT INTO category_triggers (trigger_category, trigger_value, target_category) VALUES (?, ?, ?)");
      insertTrigger.run('design', '자석젤', 'art_style');
      insertTrigger.run('design', '시럽 네일', 'art_style');
      insertTrigger.run('design', '치크 네일', 'art_style');
      insertTrigger.run('design', '드로잉', 'art_style');
      insertTrigger.run('design', '캐릭터네일', 'art_style');
      console.log(">>> Art Style triggers added.");
    }

    // Migration for art_style elements
    const hasArtStyleElements = db.prepare("SELECT count(*) as count FROM nail_elements WHERE category = 'art_style'").get() as { count: number };
    if (hasArtStyleElements.count === 0) {
      const insert = db.prepare("INSERT INTO nail_elements (category, name, value) VALUES (?, ?, ?)");
      insert.run('art_style', 'Y2K', 'Y2K');
      insert.run('art_style', '발레코어', 'Balletcore');
      insert.run('art_style', '오피스코어', 'Officecore');
      console.log(">>> Art Style elements added.");
    }

    // Migration for new base colors
    const newBaseColors = [
      { name: '레몬 옐로우', value: '#FFF700' },
      { name: '아쿠아 블루', value: '#00FFFF' },
      { name: '라일락', value: '#DCD0FF' },
      { name: '피스타치오', value: '#93C572' },
      { name: '살구색', value: '#FBCEB1' },
      { name: '연그레이', value: '#E5E5E5' },
      { name: '딥 그린', value: '#013220' },
      { name: '네이비', value: '#000080' },
      { name: '초콜릿 브라운', value: '#7B3F00' },
      { name: '와인 레드', value: '#722F37' },
      { name: '올리브', value: '#808000' },
      { name: '테라코타', value: '#E2725B' },
      { name: '샌드', value: '#C2B280' },
      { name: '차콜', value: '#36454F' }
    ];

    newBaseColors.forEach(color => {
      const exists = db.prepare("SELECT id FROM nail_elements WHERE category = 'base_color' AND name = ?").get(color.name);
      if (!exists) {
        db.prepare("INSERT INTO nail_elements (category, name, value) VALUES (?, ?, ?)").run('base_color', color.name, color.value);
        db.prepare("INSERT INTO nail_elements (category, name, value) VALUES (?, ?, ?)").run('base_color_right', color.name, color.value);
      }
    });
    console.log(">>> New base colors migration completed.");

    // Migration for basic nail elements (length, shape, design, etc.)
    const basicCategories = [
      { category: 'length', name: '베리 숏 (Very Short)', value: 'Very Short' },
      { category: 'length', name: '숏 (Short)', value: 'Short' },
      { category: 'length', name: '미디엄 (Medium)', value: 'Medium' },
      { category: 'length', name: '롱 (Long)', value: 'Long' },
      { category: 'length', name: '익스텐션 (Extension)', value: 'Extension' },
      { category: 'shape', name: '오발', value: 'Oval' },
      { category: 'shape', name: '스퀘어', value: 'Square' },
      { category: 'shape', name: '아몬드', value: 'Almond' },
      { category: 'shape', name: '발레리나', value: 'Ballerina' },
      { category: 'shape', name: '코핀', value: 'Coffin' },
      { category: 'shape', name: '라운드', value: 'Round' },
      { category: 'shape', name: '포인티드', value: 'Pointed' },
      { category: 'design', name: '자석젤', value: 'Magnet Gel' },
      { category: 'design', name: '시럽 네일', value: 'Syrup' },
      { category: 'design', name: '치크 네일', value: 'Cheek' },
      { category: 'design', name: '드로잉', value: 'Drawing' },
      { category: 'design', name: '프렌치', value: 'French' },
      { category: 'design', name: '그라데이션', value: 'Gradation' },
      { category: 'design', name: '풀컬러', value: 'Full Color' },
      { category: 'design', name: '마블', value: 'Marble' },
      { category: 'finish', name: '유광 (Glossy)', value: 'Glossy' },
      { category: 'finish', name: '무광 (Matte)', value: 'Matte' },
      { category: 'color_tone', name: '웜톤', value: 'Warm' },
      { category: 'color_tone', name: '쿨톤', value: 'Cool' },
      { category: 'color_tone', name: '뉴트럴', value: 'Neutral' },
      { category: 'parts_yn', name: '있음', value: 'Yes' },
      { category: 'parts_yn', name: '없음', value: 'No' },
      { category: 'lr_style', name: '대칭', value: 'Symmetric' },
      { category: 'lr_style', name: '비대칭 (언밸런스)', value: 'Asymmetric' },
      { category: 'mood', name: '러블리', value: 'Lovely' },
      { category: 'mood', name: '힙한', value: 'Hip' },
      { category: 'mood', name: '청순한', value: 'Pure' },
      { category: 'mood', name: '시크한', value: 'Chic' },
      { category: 'mood', name: '귀여운', value: 'Cute' },
      { category: 'concept', name: '빈티지', value: 'Vintage' },
      { category: 'concept', name: '키치', value: 'Kitsch' },
      { category: 'concept', name: '미니멀', value: 'Minimal' },
      { category: 'concept', name: '화려한', value: 'Fancy' },
      { category: 'concept', name: '우아한', value: 'Elegant' },
      { category: 'concept', name: '오피스코어', value: 'Officecore' },
      { category: 'concept', name: '발레코어', value: 'Balletcore' },
      { category: 'art_style', name: 'Y2K', value: 'Y2K' },
      { category: 'art_style', name: '발레코어', value: 'Balletcore' },
      { category: 'art_style', name: '오피스코어', value: 'Officecore' },
      { category: 'art_style', name: '고스', value: 'Goth' },
      { category: 'art_style', name: '빈티지', value: 'Vintage' },
      { category: 'art_style', name: '미니멀', value: 'Minimal' },
      { category: 'parts_detail', name: '리본', value: 'Ribbon' },
      { category: 'parts_detail', name: '하트', value: 'Heart' },
      { category: 'parts_detail', name: '진주', value: 'Pearl' },
      { category: 'parts_detail', name: '큐빅', value: 'Cubic' },
      { category: 'parts_detail', name: '나비', value: 'Butterfly' },
      { category: 'parts_detail', name: '체인', value: 'Chain' },
      { category: 'point_placement', name: '엄지 포인트', value: 'Thumb' },
      { category: 'point_placement', name: '약지 포인트', value: 'Ring Finger' },
      { category: 'point_placement', name: '전체 랜덤', value: 'Random All' },
      { category: 'point_placement', name: '퐁당퐁당', value: 'Alternating' }
    ];

    basicCategories.forEach(item => {
      const exists = db.prepare("SELECT id FROM nail_elements WHERE category = ? AND name = ?").get(item.category, item.name);
      if (!exists) {
        db.prepare("INSERT INTO nail_elements (category, name, value) VALUES (?, ?, ?)").run(item.category, item.name, item.value);
      }
    });
    console.log(">>> Basic nail elements migration completed.");

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
      insertTrigger.run('design', '자석젤', 'art_style');
      insertTrigger.run('design', '시럽 네일', 'art_style');
      insertTrigger.run('design', '치크 네일', 'art_style');
      insertTrigger.run('design', '드로잉', 'art_style');
      insertTrigger.run('design', '캐릭터네일', 'art_style');
      
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
      insert.run('base_color', '레몬 옐로우', '#FFF700');
      insert.run('base_color', '아쿠아 블루', '#00FFFF');
      insert.run('base_color', '라일락', '#DCD0FF');
      insert.run('base_color', '피스타치오', '#93C572');
      insert.run('base_color', '살구색', '#FBCEB1');
      insert.run('base_color', '연그레이', '#E5E5E5');
      insert.run('base_color', '딥 그린', '#013220');
      insert.run('base_color', '네이비', '#000080');
      insert.run('base_color', '초콜릿 브라운', '#7B3F00');
      insert.run('base_color', '와인 레드', '#722F37');
      insert.run('base_color', '올리브', '#808000');
      insert.run('base_color', '테라코타', '#E2725B');
      insert.run('base_color', '샌드', '#C2B280');
      insert.run('base_color', '차콜', '#36454F');
      
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
      insert.run('base_color_right', '레몬 옐로우', '#FFF700');
      insert.run('base_color_right', '아쿠아 블루', '#00FFFF');
      insert.run('base_color_right', '라일락', '#DCD0FF');
      insert.run('base_color_right', '피스타치오', '#93C572');
      insert.run('base_color_right', '살구색', '#FBCEB1');
      insert.run('base_color_right', '연그레이', '#E5E5E5');
      insert.run('base_color_right', '딥 그린', '#013220');
      insert.run('base_color_right', '네이비', '#000080');
      insert.run('base_color_right', '초콜릿 브라운', '#7B3F00');
      insert.run('base_color_right', '와인 레드', '#722F37');
      insert.run('base_color_right', '올리브', '#808000');
      insert.run('base_color_right', '테라코타', '#E2725B');
      insert.run('base_color_right', '샌드', '#C2B280');
      insert.run('base_color_right', '차콜', '#36454F');

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

  app.get("/ping", (req, res) => res.send("pong"));

  // Debug log for environment
  console.log(`>>> NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`>>> Current directory: ${process.cwd()}`);
  console.log(`>>> __dirname: ${__dirname}`);

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      env: process.env.NODE_ENV,
      cwd: process.cwd(),
      distExists: fs.existsSync(path.resolve(__dirname, "dist")),
      indexExists: fs.existsSync(path.resolve(__dirname, "dist", "index.html")),
      time: new Date().toISOString()
    });
  });

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

  app.get("/api/result-images", (req, res) => {
    const images = db.prepare("SELECT * FROM result_images").all();
    res.json(images);
  });

  app.post("/api/result-images", (req, res) => {
    const { combination_json, image_url } = req.body;
    const info = db.prepare("INSERT INTO result_images (combination_json, image_url) VALUES (?, ?)").run(combination_json, image_url);
    res.json({ id: info.lastInsertRowid });
  });

  app.get("/api/result-images/:id", (req, res) => {
    db.prepare("DELETE FROM result_images WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Vite middleware or Static serving
  const distPath = path.resolve(__dirname, "dist");
  const isDev = process.env.NODE_ENV === "development";

  if (isDev) {
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
    console.log("Running in PRODUCTION mode");
    serveStatic(app, distPath);
  }

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
      // Fallback for SPA in root if dist/index.html is missing but root/index.html exists
      const rootIndexPath = path.resolve(__dirname, "index.html");
      if (fs.existsSync(rootIndexPath)) {
        res.sendFile(rootIndexPath);
      } else {
        res.status(404).send(`
          <h1>404 - Build Not Found</h1>
          <p>The application is running but the build files are missing.</p>
          <p>Please run 'npm run build' first.</p>
        `);
      }
    }
  });
}

startServer();
