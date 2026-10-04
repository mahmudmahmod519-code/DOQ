const pool = require("./database/pool"); // عدّل المسار حسب مشروعك
const bcrypt = require("bcrypt");

// ============================================================
// Helpers
// ============================================================
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const pickN = (arr, n) => {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, n);
};

// ============================================================
// Data Pools
// ============================================================
const firstNamesMale = [
  "أحمد",
  "محمد",
  "محمود",
  "مصطفى",
  "عمر",
  "علي",
  "حسن",
  "حسين",
  "خالد",
  "سعيد",
  "يوسف",
  "إبراهيم",
  "يحيى",
  "كريم",
  "طارق",
  "شريف",
  "عمرو",
  "هشام",
  "سامح",
  "رامي",
  "أيمن",
  "ماجد",
  "نادر",
  "وليد",
  "عادل",
  "فادي",
  "جورج",
  "مينا",
  "بيتر",
  "مرقس",
  "زياد",
  "رؤوف",
  "شادي",
  "أمير",
  "تامر",
  "سيف",
  "نور",
  "آدم",
  "زياد",
  "حمزة",
];

const firstNamesFemale = [
  "فاطمة",
  "عائشة",
  "مريم",
  "زينب",
  "سارة",
  "نورة",
  "هند",
  "منى",
  "ليلى",
  "دينا",
  "ياسمين",
  "هبة",
  "نورهان",
  "سلمى",
  "مروة",
  "شيماء",
  "إيمان",
  "نهى",
  "رانيا",
  "أميرة",
  "علياء",
  "رحمة",
  "بسنت",
  "جنى",
  "ملك",
  "حبيبة",
  "روان",
  "لمار",
  "تالية",
  "غالية",
  "سمر",
  "عبير",
  "وفاء",
  "سمية",
  "أسماء",
  "حنان",
  "نادية",
  "سعاد",
  "فايزة",
  "زهرة",
];

const familyNames = [
  "عبدالله",
  "محمود",
  "حسن",
  "سعيد",
  "إبراهيم",
  "علي",
  "الخولي",
  "الششتاوي",
  "الفقي",
  "شلبي",
  "الجندي",
  "العشري",
  "حجازي",
  "الشافعي",
  "البدري",
  "السيد",
  "الغزالي",
  "الشامي",
  "بدر",
  "زهران",
  "الكاتب",
  "منصور",
  "شاكر",
  "راشد",
  "صلاح",
  "نصار",
  "صابر",
  "الحلواني",
  "الشرقاوي",
  "التميمي",
  "القحطاني",
  "العتيبي",
  "الزهراني",
  "المصري",
  "العراقي",
  "الشامي",
  "الحلبي",
  "البغدادي",
  "المغربي",
  "التونسي",
];

const cities = [
  "القاهرة",
  "الإسكندرية",
  "الجيزة",
  "المنصورة",
  "طنطا",
  "الزقازيق",
  "بورسعيد",
  "السويس",
  "الإسماعيلية",
  "أسوان",
  "الأقصر",
  "أسيوط",
  "سوهاج",
  "قنا",
  "المنيا",
  "بني سويف",
  "الفيوم",
  "دمياط",
  "كفر الشيخ",
  "دمنهور",
  "شبين الكوم",
  "بنها",
  "الطور",
  "مرسى مطروح",
];

const districts = {
  القاهرة: [
    "الدقي",
    "المهندسين",
    "مدينة نصر",
    "المعادي",
    "مصر الجديدة",
    "الزمالك",
    "وسط البلد",
    "شبرا",
    "حلوان",
    "العباسية",
  ],
  الإسكندرية: [
    "جليم",
    "سيدي جابر",
    "العجمي",
    "المنتزه",
    "سموحة",
    "محرم بك",
    "الرمل",
    "سيدي بشر",
    "المندرة",
    "كرموز",
  ],
  الجيزة: [
    "الهرم",
    "فيصل",
    "الدقي",
    "العجوزة",
    "إمبابة",
    "البدرشين",
    "أوسيم",
    "كرداسة",
    "الوراق",
    "6 أكتوبر",
  ],
  المنصورة: ["المنصورة", "طلخا", "ميت غمر", "دكرنس", "المنزلة", "منية النصر"],
  طنطا: ["طنطا", "المحلة الكبرى", "كفر الزيات", "بسيون", "قطور", "السنطة"],
};

const streets = [
  "شارع التحرير",
  "شارع النيل",
  "شارع الجمهورية",
  "شارع 9",
  "شارع الهرم",
  "شارع فيصل",
  "شارع صلاح سالم",
  "شارع رمسيس",
  "شارع الجيش",
  "شارع بورسعيد",
  "شارع شبرا",
  "شارع المعز",
  "شارع جامعة الدول",
  "شارع الثورة",
  "شارع مصطفى النحاس",
];

const kitchenAdjectives = [
  "مطبخ الست",
  "مطبخ الشيف",
  "مطبخ الحاج",
  "مطبخ أم",
  "مطبخ أبو",
  "بيت",
  "برجر",
  "بيتزا",
  "شاورما",
  "كشري",
  "فول",
  "طعمية",
  "كبدة",
  "حواوشي",
  "مشويات",
  "حلويات",
  "معجنات",
  "مأكولات",
  "أكلات",
  "أطباق",
];

const kitchenSuffixes = [
  "آند كو",
  "السيد",
  "الشرقاوي",
  "الشامي",
  "الصعيدي",
  "الإسكندراني",
  "البحر",
  "الوادي",
  "الأصيل",
  "البلدي",
  "الشرقي",
  "الغربي",
  "التراثي",
  "الحديث",
  "السريع",
  "الطازج",
  "المميز",
  "الشهير",
  "الذهبي",
  "الفضي",
];

const dishPrefixes = [
  "كيلو",
  "طاجن",
  "صينية",
  "طبق",
  "وجبة",
  "ساندوتش",
  "نص كيلو",
  "ربع كيلو",
];

const dishNames = [
  // مشويات
  "كفتة مشوية",
  "كفتة حواوشي",
  "كباب",
  "ريش ضاني",
  "فراخ مشوية",
  "دجاج شواية",
  "حمام محشي",
  "أرانب",
  "كبدة إسكندراني",
  "سجق",
  "ممبار",
  "حمام مشوي",
  "رول لحم",
  // أطباق رئيسية
  "طاجن بامية",
  "طاجن مسقعة",
  "طاجن بطاطس",
  "طاجن كوارع",
  "فتة باللحم",
  "فتة بالخل",
  "محشي ورق عنب",
  "محشي كرنب",
  "محشي باذنجان",
  "محشي فلفل",
  "مسقعة",
  "صيادية",
  "مندي لحم",
  "كبسة دجاج",
  "مقلوبة",
  "شاورما لحم",
  "شاورما دجاج",
  "شيش طاووق",
  "كشري",
  "فول مدمس",
  "طعمية",
  "حواوشي",
  "كبدة",
  "سجق",
  "رز بلبن",
  "ملوخية",
  // بحري
  "سمك مشوي",
  "سمك مقلي",
  "جمبري",
  "كابوريا",
  "كاليماري",
  "سبيط",
  "دنيس",
  "قاروص",
  "بوري مشوي",
  "رنجة",
  "فسيخ",
  "سلطة جمبري",
  // وجبات سريعة
  "برجر دبل",
  "برجر كلاسيك",
  "تشيز برجر",
  "بيتزا مارجريتا",
  "بيتزا بيبروني",
  "بيتزا خضار",
  "ساندوتش شاورما",
  "ساندوتش فلافل",
  "ساندوتش كبدة",
  "بطاطس مقلية",
  "أجنحة دجاج",
  "ناجتس",
  "ستربس",
  "هوت دوج",
  "فيليه دجاج",
  // حلويات
  "كنافة نابلسية",
  "كنافة بالقشطة",
  "بسبوسة",
  "أم علي",
  "رز بلبن",
  "مهلبية",
  "كاسترد",
  "تورتة شوكولاتة",
  "تشيز كيك",
  "ماكارون",
  "كوكيز",
  "براوني",
  "موس شوكولاتة",
  "بودينغ",
  "فطائر تفاح",
  "حلاوة طحينية",
  "لقمة القاضي",
  "زلابية",
  "بلح الشام",
  "بقلاوة",
];

const categoriesData = [
  ["مشويات", "جميع أنواع اللحوم والدواجن المشوية على الفحم"],
  ["حلويات", "حلويات شرقية وغربية طازجة"],
  ["مأكولات بحرية", "أسماك وفواكه البحر طازجة"],
  ["وجبات سريعة", "برجر وبيتزا وبطاطس"],
  ["مقبلات", "مقبلات ساخنة وباردة"],
  ["أطباق رئيسية", "أطباق رئيسية متنوعة"],
  ["سلطات", "سلطات طازجة"],
  ["شوربات", "شوربات ساخنة"],
  ["معجنات", "معجنات وفطائر"],
  ["مشروبات", "عصائر ومشروبات"],
  ["فطور", "أكلات فطور مصرية وعربية"],
  ["غداء", "وجبات غداء دسمة"],
  ["عشاء", "وجبات عشاء خفيفة"],
  ["نباتي", "أطباق نباتية صحية"],
  ["أطفال", "وجبات مخصصة للأطفال"],
  ["مأكولات شرقية", "كبسة، مندي، مقلوبة"],
  ["مأكولات غربية", "باستا، ستيك، برجر"],
  ["مخبوزات", "خبز ومعجنات طازجة"],
  ["آيس كريم", "آيس كريم بأنواعه"],
  ["مشروبات ساخنة", "قهوة، شاي، ساخنة"],
];

const kitchenDescriptions = [
  "مطبخ منزلي متخصص في الأكل البيتي الأصيل، نستخدم أجود المكونات الطازجة يومياً.",
  "نقدم أشهى الأطباق الشرقية والغربية بأيدي شيفات محترفين.",
  "مطبخ متكامل يقدم وجبات لذيذة بأسعار مناسبة، توصيل سريع لجميع المناطق.",
  "خبرة أكثر من 15 عاماً في مجال الطبخ الشرقي والغربي.",
  "مطبخ صحي يهتم بالجودة والنظافة، نستخدم زيت زيتون بكر ممتاز.",
  "متخصصون في المشويات على الفحم والحواوشي والكبدة الإسكندراني.",
  "حلويات شرقية وغربية طازجة يومياً بأجود المكونات.",
  "مأكولات بحرية طازجة من البحر مباشرة إلى مائدتك.",
  "أكلات بيتي زي ما ماما كانت بتعملها، بمكونات طبيعية 100%.",
  "مطبخ عصري يقدم أطباق مبتكرة بخبرة شيفات عالمية.",
];

const reviewComments = [
  // 5 نجوم
  "طعام رائع جداً، أنصح به بشدة!",
  "التسوية مظبوطة والطعم خيالي",
  "أفضل وجبة أكلتها في حياتي",
  "كمية كبيرة وسعر مناسب",
  "التوصيل سريع والطعم أصلي",
  "مكونات طازجة وجودة عالية",
  "هكرر الطلب أكيد",
  "الشيف متمكن جداً",
  "تسلم إيديكم، طعم تحفة",
  "أحلى أكلة في مصر",
  "الطعم زي بيت أمي بالظبط",
  "خدمة ممتازة وطعام لذيذ",
  "أنصح الجميع بتجربته",
  "جودة عالية وسعر معقول",
  "بجد تحفة فنية، برافو عليكم",
  "وجبة متكاملة وشهية",
  "تعامل راقي وطعام مميز",
  "هطلب تاني أكيد",
  "الأكل وصل سخن وطازج",
  "كمية مشبعة وطعم رائع",
  // 4 نجوم
  "لذيذ بس كان محتاج ملح شوية",
  "جميل بس السعر غالي شوية",
  "طعم حلو بس الكمية صغيرة",
  "جيد جداً بس التوصيل اتأخر",
  "لذيذ ومشبع، بس محتاج تحسين في التغليف",
  "حلو بس مش الأفضل",
  "طعم جيد بس كانت محتاجة سخونة أكتر",
  "ممتاز بس البطاطس كانت شبه باردة",
  // 3 نجوم
  "متوسط، مفيش حاجة مميزة",
  "عادي جداً بالنسبة للسعر",
  "مقبول بس مش هي اللي هرجعله",
  "مفيش حاجة وحشة بس مفيش حاجة مميزة",
  "جيد بس التوصيل اتأخر كتير",
  "مش زي المرة اللي فاتت",
  // 2 نجوم
  "للأسف مش زي ما توقعت",
  "الأكل كان بارد والطعم مش حلو",
  "خدمة سيئة والطعام أسوأ",
  "مش هرجع أطلب تاني",
  "الكمية قليلة جداً بالنسبة للسعر",
  // 1 نجمة
  "تجربة سيئة جداً، لا أنصح به",
  "الطعام كان فاسد",
  "أسوأ وجبة أكلتها",
  "خدمة سيئة ومستهترة",
];

async function seedDatabase() {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.DOQ_ALLOW_SEED !== "true"
  ) {
    throw new Error("seed_requires_nonproduction_and_DOQ_ALLOW_SEED_true");
  }
  const seedPassword = String(process.env.DOQ_SEED_PASSWORD || "");
  if (seedPassword.length < 12)
    throw new Error("DOQ_SEED_PASSWORD_must_be_at_least_12_characters");
  const connection = await pool.getConnection();

  try {
    const startTime = Date.now();
    console.log("🌱 بدء تعبئة قاعدة البيانات...\n");

    // إعدادات سريعة
    const NUM_ADMINS = 3;
    const NUM_CHEFS = 300;
    const NUM_CUSTOMERS = 900;
    const NUM_KITCHENS = 300; // مطبخ لكل شيف تقريباً
    const DISHES_PER_KITCHEN_MIN = 5;
    const DISHES_PER_KITCHEN_MAX = 12;
    const REVIEWS_PER_DISH_MIN = 0;
    const REVIEWS_PER_DISH_MAX = 15;

    // ======================================================
    // 1. Categories
    // ======================================================
    console.log("📁 إضافة التصنيفات...");
    for (const [name, description] of categoriesData) {
      await connection.query(
        `INSERT IGNORE INTO categories (name, description) VALUES (?, ?)`,
        [name, description],
      );
    }
    const [cats] = await connection.query(`SELECT id, name FROM categories`);
    console.log(`✅ تم إضافة ${cats.length} تصنيف\n`);

    // ======================================================
    // 2. Users — Batch Insert
    // ======================================================
    console.log("👥 إضافة المستخدمين...");
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(seedPassword, salt);

    const usedEmails = new Set();
    const usedPhones = new Set();

    function uniqueEmail(prefix, suffix) {
      let email;
      do {
        email = `${prefix}${suffix}@doq.com`;
        suffix++;
      } while (usedEmails.has(email));
      usedEmails.add(email);
      return email;
    }

    function uniquePhone() {
      let phone;
      do {
        phone = `01${rand(0, 2)}${String(rand(10000000, 99999999))}`;
      } while (usedPhones.has(phone));
      usedPhones.add(phone);
      return phone;
    }

    // بناء كل المستخدمين
    const allUsers = [];

    // Admins
    for (let i = 1; i <= NUM_ADMINS; i++) {
      allUsers.push({
        first_name: pick(firstNamesMale),
        last_name: pick(familyNames),
        phone: uniquePhone(),
        email: `admin${i}@doq.com`,
        role: "admin",
        city: pick(cities),
      });
    }

    // Chefs
    for (let i = 1; i <= NUM_CHEFS; i++) {
      const isMale = Math.random() > 0.3;
      allUsers.push({
        first_name: isMale ? pick(firstNamesMale) : pick(firstNamesFemale),
        last_name: pick(familyNames),
        phone: uniquePhone(),
        email: uniqueEmail("chef", i),
        role: "chef",
        city: pick(cities),
      });
    }

    // Customers
    for (let i = 1; i <= NUM_CUSTOMERS; i++) {
      const isMale = Math.random() > 0.5;
      allUsers.push({
        first_name: isMale ? pick(firstNamesMale) : pick(firstNamesFemale),
        last_name: pick(familyNames),
        phone: uniquePhone(),
        email: uniqueEmail("user", i),
        role: "customer",
        city: pick(cities),
      });
    }

    // Batch insert — 200 صف في المرة
    const BATCH = 200;
    const createdUsers = [];

    for (let i = 0; i < allUsers.length; i += BATCH) {
      const chunk = allUsers.slice(i, i + BATCH);
      const values = chunk.map((u) => [
        u.first_name,
        u.last_name,
        u.phone,
        u.city,
        u.email,
        passwordHash,
        u.role,
        "JMXDUNTSJNPEEMCGLZJDQ6BDIFDVKUCT",
        1,
      ]);

      const [result] = await connection.query(
        `INSERT INTO users 
                 (first_name, last_name, phone_number, city, email, password_hash, roles,two_factor_secret,two_factor_enabled) 
                 VALUES ?`,
        [values],
      );

      // result.insertId هو أول ID في الـ batch
      for (let j = 0; j < chunk.length; j++) {
        createdUsers.push({
          id: result.insertId + j,
          role: chunk[j].role,
          name: `${chunk[j].first_name} ${chunk[j].last_name}`,
        });
      }

      if ((i / BATCH) % 2 === 0) {
        process.stdout.write(
          `\r   → ${createdUsers.length}/${allUsers.length}`,
        );
      }
    }
    process.stdout.write(
      `\r   → ${createdUsers.length}/${allUsers.length} ✅\n`,
    );
    console.log(`✅ تم إضافة ${createdUsers.length} مستخدم\n`);

    // ======================================================
    // 3. Kitchens — Batch Insert
    // ======================================================
    console.log("🍳 إضافة المطابخ...");
    const chefs = createdUsers.filter((u) => u.role === "chef");
    const usedTitles = new Set();

    function uniqueTitle(base) {
      let title = base;
      let n = 1;
      while (usedTitles.has(title)) {
        title = `${base} ${n++}`;
      }
      usedTitles.add(title);
      return title;
    }

    const kitchensToInsert = [];
    for (let i = 0; i < NUM_KITCHENS && i < chefs.length; i++) {
      const chef = chefs[i];
      const adj = pick(kitchenAdjectives);
      const suffix = pick(kitchenSuffixes);
      const city = pick(cities);
      const districtList = districts[city] || districts["القاهرة"];
      const district = pick(districtList);
      const address = `${pick(streets)} - ${district}`;

      kitchensToInsert.push([
        uniqueTitle(`${adj} ${suffix}`),
        pick(kitchenDescriptions),
        city,
        address,
        `011${rand(10000000, 99999999)}`,
        chef.id,
        "ACTIVE",
      ]);
    }

    const createdKitchens = [];
    for (let i = 0; i < kitchensToInsert.length; i += BATCH) {
      const chunk = kitchensToInsert.slice(i, i + BATCH);
      const [result] = await connection.query(
        `INSERT INTO kitchens 
                 (title, description, city, address, phone_number, user_id, status) 
                 VALUES ?`,
        [chunk],
      );
      for (let j = 0; j < chunk.length; j++) {
        createdKitchens.push({
          id: result.insertId + j,
          chefId: chunk[j][5],
        });
      }
    }
    console.log(`✅ تم إضافة ${createdKitchens.length} مطبخ\n`);

    // ======================================================
    // 4. Dishes — Batch Insert
    // ======================================================
    console.log("🍲 إضافة الأطباق...");
    const dishesToInsert = [];

    for (const kitchen of createdKitchens) {
      const numDishes = rand(DISHES_PER_KITCHEN_MIN, DISHES_PER_KITCHEN_MAX);
      const usedDishNames = new Set();

      for (let d = 0; d < numDishes; d++) {
        let dishName;
        let tries = 0;
        do {
          const prefix = Math.random() > 0.5 ? pick(dishPrefixes) + " " : "";
          dishName = prefix + pick(dishNames);
          tries++;
        } while (usedDishNames.has(dishName) && tries < 10);
        usedDishNames.add(dishName);

        const category = pick(cats);
        const price = (Math.random() * 350 + 20).toFixed(2);

        dishesToInsert.push([
          dishName,
          `طبق لذيذ محضر بمكونات طازجة يومياً - ${dishName}`,
          pick([
            "لحم, أرز, خضار",
            "دجاج, بهارات, أرز",
            "سمك, ليمون, خضار",
            "جبنة, طماطم, ريحان",
            "مكونات طازجة متنوعة",
          ]),
          price,
          category.id,
          kitchen.id,
        ]);
      }
    }

    const createdDishes = [];
    for (let i = 0; i < dishesToInsert.length; i += BATCH) {
      const chunk = dishesToInsert.slice(i, i + BATCH);
      const [result] = await connection.query(
        `INSERT INTO dishes 
                 (name, description, ingredients, price, category_id, kitchen_id) 
                 VALUES ?`,
        [chunk],
      );
      for (let j = 0; j < chunk.length; j++) {
        createdDishes.push({
          id: result.insertId + j,
          kitchenId: chunk[j][5],
        });
      }
      if ((i / BATCH) % 5 === 0) {
        process.stdout.write(
          `\r   → ${createdDishes.length}/${dishesToInsert.length}`,
        );
      }
    }
    process.stdout.write(
      `\r   → ${createdDishes.length}/${dishesToInsert.length} ✅\n`,
    );
    console.log(`✅ تم إضافة ${createdDishes.length} طبق\n`);

    // ======================================================
    // 5. Reviews — Batch Insert
    // ======================================================
    console.log("⭐ إضافة التقييمات...");
    const customers = createdUsers.filter((u) => u.role === "customer");

    // مهم: الـ unique constraint على (user_id, dish_id)
    // فمحتاج نتتبع كل (user, dish) لمنع التكرار
    const reviewsToInsert = [];
    const usedPairs = new Set();

    for (const dish of createdDishes) {
      const numReviews = rand(REVIEWS_PER_DISH_MIN, REVIEWS_PER_DISH_MAX);

      // اختر عملاء عشوائيين
      const chosenCustomers = pickN(
        customers,
        Math.min(numReviews, customers.length),
      );

      for (const customer of chosenCustomers) {
        const pairKey = `${customer.id}-${dish.id}`;
        if (usedPairs.has(pairKey)) continue;
        usedPairs.add(pairKey);

        // rating مع توزيع واقعي (معظم الناس بتدي 4-5)
        const r = Math.random();
        let rating;
        if (r < 0.55) rating = 5;
        else if (r < 0.8) rating = 4;
        else if (r < 0.92) rating = 3;
        else if (r < 0.97) rating = 2;
        else rating = 1;

        // اختار تعليق مناسب للتقييم
        const comment = pick(reviewComments);

        reviewsToInsert.push([customer.id, dish.id, rating, comment]);
      }
    }

    let insertedReviews = 0;
    for (let i = 0; i < reviewsToInsert.length; i += BATCH) {
      const chunk = reviewsToInsert.slice(i, i + BATCH);
      try {
        await connection.query(
          `INSERT IGNORE INTO reviews (user_id, dish_id, rating, comment) VALUES ?`,
          [chunk],
        );
        insertedReviews += chunk.length;
      } catch (err) {
        // في حالة unique constraint، نكمل
        console.error("\n⚠️  بعض التقييمات اتخطت:", err.code);
      }
      if ((i / BATCH) % 5 === 0) {
        process.stdout.write(
          `\r   → ${insertedReviews}/${reviewsToInsert.length}`,
        );
      }
    }
    process.stdout.write(
      `\r   → ${insertedReviews}/${reviewsToInsert.length} ✅\n`,
    );
    console.log(`✅ تم إضافة ${insertedReviews} تقييم\n`);

    // ======================================================
    // Summary
    // ======================================================
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log("\n🎉 تم تعبئة قاعدة البيانات بنجاح!");
    console.log("=====================================");
    console.log(`Users      : ${createdUsers.length}`);
    console.log(
      `  - admins : ${createdUsers.filter((u) => u.role === "admin").length}`,
    );
    console.log(
      `  - chefs  : ${createdUsers.filter((u) => u.role === "chef").length}`,
    );
    console.log(
      `  - customers: ${createdUsers.filter((u) => u.role === "customer").length}`,
    );
    console.log(`Categories : ${cats.length}`);
    console.log(`Kitchens   : ${createdKitchens.length}`);
    console.log(`Dishes     : ${createdDishes.length}`);
    console.log(`Reviews    : ${insertedReviews}`);
    console.log(`⏱️  الوقت    : ${elapsed}s`);
    console.log("=====================================");

    console.log(
      "\nSeed accounts use DOQ_SEED_PASSWORD; the password is never printed.",
    );
    console.log("\n👤 Admins:");
    console.log("   admin1@doq.com, admin2@doq.com, admin3@doq.com");
    console.log("\n👨‍🍳 Chefs (أمثلة):");
    console.log("   chef1@doq.com ... chef" + NUM_CHEFS + "@doq.com");
    console.log("\n👥 Customers (أمثلة):");
    console.log("   user1@doq.com ... user" + NUM_CUSTOMERS + "@doq.com");
  } catch (error) {
    console.error("\n❌ خطأ أثناء تعبئة البيانات:", error);
    throw error;
  } finally {
    connection.release();
  }
}

// تشغيل السكريبت لوحده
if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = seedDatabase;
