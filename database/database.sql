
CREATE DATABASE IF NOT EXISTS DOQ;
USE DOQ;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    phone_number VARCHAR(15) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    code VARCHAR(6) DEFAULT NULL,
    roles VARCHAR(50) NOT NULL DEFAULT 'customer',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS kitchens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    city VARCHAR(100),
    address VARCHAR(255),
    image_url VARCHAR(255),
    portfolio_url VARCHAR(255),
    phone_number VARCHAR(15) NOT NULL UNIQUE,
    user_id INT NOT NULL,
    status VARCHAR(225) NOT NULL DEFAULT 'ACTIVE' ,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_kitchen_user (user_id)
);

CREATE TABLE IF NOT EXISTS dishes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    ingredients TEXT,
    price DECIMAL(10, 2) NOT NULL CHECK (price >= 0 AND price <= 10000),
    image_url VARCHAR(255),
    category_id INT NOT NULL,
    kitchen_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
    FOREIGN KEY (kitchen_id) REFERENCES kitchens(id) ON DELETE CASCADE,
    INDEX idx_dishes_category (category_id),
    INDEX idx_dishes_kitchen (kitchen_id)
);

CREATE TABLE IF NOT EXISTS reviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    dish_id INT NOT NULL,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (dish_id) REFERENCES dishes(id) ON DELETE CASCADE,
    INDEX idx_reviews_user (user_id),
    INDEX idx_reviews_dish (dish_id),
    CONSTRAINT unique_user_dish_review UNIQUE (user_id, dish_id)
);


CREATE INDEX idx_kitchens_user_id ON kitchens(user_id);
CREATE INDEX idx_kitchens_title ON kitchens(title);
CREATE INDEX idx_kitchens_phone ON kitchens(phone_number);









-- 2. إضافة المستخدمين (10 مستخدمين)
-- ============================================
-- كلمات السر كلها: P@ssword123!
-- تم تشفيرها باستخدام bcrypt (saltRounds = 10)
INSERT INTO users (first_name, last_name, phone_number, email, password_hash, code, roles) VALUES
-- المشرف (Admin) - موجود مسبقاً
('محمد', 'حسن', '01234567890', 'mohamed@example.com', '$2b$10$E42LYB3IMQ4KFekj8NV2yOZzDBA81yaTFnyzRKM9oa5ykAWA4OUW.', '987654', 'admin'),

-- الشيفات (Chefs) - 3 شيفات
('سارة', 'محمود', '01122334455', 'sara@example.com', '$2b$10$E42LYB3IMQ4KFekj8NV2yOZzDBA81yaTFnyzRKM9oa5ykAWA4OUW.', '654321', 'chef'),
('أحمد', 'إبراهيم', '01123456789', 'ahmed.ibrahim@example.com', '$2b$10$E42LYB3IMQ4KFekj8NV2yOZzDBA81yaTFnyzRKM9oa5ykAWA4OUW.', '111111', 'chef'),
('فاطمة', 'علي', '01134567890', 'fatma.ali@example.com', '$2b$10$E42LYB3IMQ4KFekj8NV2yOZzDBA81yaTFnyzRKM9oa5ykAWA4OUW.', '222222', 'chef'),
('يوسف', 'محمد', '01145678901', 'youssef@example.com', '$2b$10$E42LYB3IMQ4KFekj8NV2yOZzDBA81yaTFnyzRKM9oa5ykAWA4OUW.', '333333', 'chef'),

-- العملاء (Customers) - 6 عملاء
('أحمد', 'علي', '01012345678', 'ahmed@example.com', '$2b$10$E42LYB3IMQ4KFekj8NV2yOZzDBA81yaTFnyzRKM9oa5ykAWA4OUW.', '123456', 'customer'),
('منى', 'حسن', '01023456789', 'mona@example.com', '$2b$10$E42LYB3IMQ4KFekj8NV2yOZzDBA81yaTFnyzRKM9oa5ykAWA4OUW.', '234567', 'customer'),
('خالد', 'سعيد', '01034567890', 'khaled@example.com', '$2b$10$E42LYB3IMQ4KFekj8NV2yOZzDBA81yaTFnyzRKM9oa5ykAWA4OUW.', '345678', 'customer'),
('نورة', 'إبراهيم', '01045678901', 'noura@example.com', '$2b$10$E42LYB3IMQ4KFekj8NV2yOZzDBA81yaTFnyzRKM9oa5ykAWA4OUW.', '456789', 'customer'),
('عمر', 'الخولي', '01056789012', 'omar@example.com', '$2b$10$E42LYB3IMQ4KFekj8NV2yOZzDBA81yaTFnyzRKM9oa5ykAWA4OUW.', '567890', 'customer'),
('ليلى', 'محمود', '01067890123', 'laila@example.com', '$2b$10$E42LYB3IMQ4KFekj8NV2yOZzDBA81yaTFnyzRKM9oa5ykAWA4OUW.', '678901', 'customer');

-- ============================================
-- 3. إضافة التصنيفات (4 فئات)
-- ============================================
INSERT INTO categories (name, description) VALUES
('مشويات', 'جميع أنواع اللحوم والدواجن المشوية على الفحم مع التوابل الشرقية'),
('حلويات', 'حلويات شرقية وغربية طازجة محضرة بأجود المكونات'),
('مأكولات بحرية', 'أسماك وفواكه البحر طازجة يومياً من البحر إلى مائدتك'),
('وجبات سريعة', 'برجر, بيتزا, وبطاطس مقلية بأسلوب عصري');

-- ============================================
-- 4. إضافة المطابخ (4 مطابخ)
-- ============================================
-- الشيف سارة (user_id = 2) لديها مطبخان
-- الشيف أحمد إبراهيم (user_id = 3) لديه مطبخ واحد
-- الشيف فاطمة علي (user_id = 4) لديها مطبخ واحد
INSERT INTO kitchens (title, description, city, address, phone_number, user_id, image_url) VALUES
('مطبخ الست سارة', 'أكل بيتي مصري على أصولة وصحي جداً, نستخدم أجود المكونات الطازجة يومياً', 'القاهرة', '١٢ شارع التحرير, الدقي', '01122334455', 2, 'uploads/kitchen1.jpg'),
('برجر آند كو', 'أقوى برجر مشوي على الفحم في المدينة, وصفات سرية ومكونات طازجة', 'الإسكندرية', 'طريق الجيش, جليم', '01234567890', 2, 'uploads/kitchen2.jpg'),
('مطبخ الشيف أحمد', 'مأكولات شرقية وعربية بأسلوب عصري, نقدم أشهى الأطباق العربية', 'الجيزة', 'شارع الهرم, الجيزة', '01123456789', 3, 'uploads/kitchen3.jpg'),
('مطبخ فاطمة علي', 'حلويات شرقية وغربية فاخرة, صناعة يدوية بأجود المكونات', 'مدينة نصر', 'شارع عباس العقاد, مدينة نصر', '01134567890', 4, 'uploads/kitchen4.jpg');

-- ============================================
-- 5. إضافة الأطباق (10 أطباق لكل مطبخ = 40 طبق)
-- ============================================

-- مطبخ الست سارة (kitchen_id = 1) - 10 أطباق
INSERT INTO dishes (name, description, price, category_id, kitchen_id, image_url, ingredients) VALUES
('كيلو كفتة مشوية', 'كفتة لحم بلدي مشوية على الفحم مع سلطات وعيش بلدي', 350.00, 1, 1, 'uploads/kofta1.jpg', 'لحم, خضار, خبز'),
('طاجن بامية باللحمة', 'طاجن بامية في الفرن باللحم الضاني البلدي مع أرز أبيض', 180.00, 1, 1, 'uploads/bamia1.jpg', 'بامية, لحم, أرز'),
('صينية بسبوسة بالمكسرات', 'بسبوسة مصرية بالسمن البلدي والقشطة والمكسرات', 120.00, 2, 1, 'uploads/basbousa1.jpg', 'بسبوسة, سمن, قشطة, مكسرات'),
('محشي ورق عنب', 'ورق عنب محشي بالأرز واللحم المفروم مع صلصة الطماطم', 160.00, 1, 1, 'uploads/mahshi1.jpg', 'ورق عنب, أرز, لحم'),
('طاجن مسقعة بالبشاميل', 'مسقعة باللحم المفروم والبشاميل المخبوزة', 200.00, 1, 1, 'uploads/moussaka1.jpg', 'مسقعة, لحم, بشاميل'),
('كنافة نابلسية', 'كنافة بالجبنة النابلسية مع قطر خفيف ومكسرات', 95.00, 2, 1, 'uploads/kanafa1.jpg', 'كنافة, جبنة, قطر, مكسرات'),
('شاورما سوري', 'شاورما لحم سوري مع صلصة الثوم والخضار', 120.00, 4, 1, 'uploads/shawarma1.jpg', 'شاورما, ثوم, خضار'),
('أم علي', 'حلوى أم علي التقليدية بالقشطة والمكسرات', 75.00, 2, 1, 'uploads/omali1.jpg', 'أم علي, قشطة, مكسرات'),
('فتة باللحم', 'فتة مصرية باللحم والأرز والخبز المحمص', 220.00, 1, 1, 'uploads/fatta1.jpg', 'فتة, لحم, أرز, خبز'),
('ممبار', 'ممبار محشي بالأرز واللحم المفروم', 140.00, 1, 1, 'uploads/mombar1.jpg', 'ممبار, أرز, لحم');

-- برجر آند كو (kitchen_id = 2) - 10 أطباق
INSERT INTO dishes (name, description, price, category_id, kitchen_id, image_url, ingredients) VALUES
('تشيز برجر دبل', 'قطعتين لحم مع جبنة شيدر, صوص البرجر المميز وخضار', 150.00, 4, 2, 'uploads/burger1.jpg', 'لحم, جبنة, صوص, خضار'),
('برجر كلاسيك', 'برجر لحم بقري مع خس, طماطم, بصل, وصوص خاص', 120.00, 4, 2, 'uploads/burger2.jpg', 'لحم, خس, طماطم, بصل, صوص'),
('بيتزا مارجريتا', 'بيتزا كلاسيكية بصوص الطماطم والموزاريلا والريحان', 110.00, 4, 2, 'uploads/pizza1.jpg', 'بيتزا, صوص, موزاريلا, ريحان'),
('بيتزا بيبروني', 'بيتزا بصوص الطماطم, بيبروني, وجبنة موزاريلا', 130.00, 4, 2, 'uploads/pizza2.jpg', 'بيتزا, صوص, بيبروني, جبنة'),
('بطاطس مقلية بالبهارات', 'بطاطس طازجة مقلية مع بهارات سرية', 40.00, 4, 2, 'uploads/fries1.jpg', 'بطاطس, بهارات'),
('أجنحة دجاج حارة', 'أجنحة دجاج متبلة بصوص حار مع صلصة الرانش', 90.00, 4, 2, 'uploads/wings1.jpg', 'أجنحة دجاج, صوص, صلصة'),
('ساندوتش شاورما دجاج', 'شاورما دجاج مع خضار وصلصة الثوم', 85.00, 4, 2, 'uploads/shawarma2.jpg', 'شاورما, خضار, صلصة'),
('ساندوتش فلافل', 'فلافل محضرة منزلياً مع طحينة وخضار', 45.00, 4, 2, 'uploads/falafel1.jpg', 'فلافل, طحينة, خضار'),
('وجبة عائلية مشكلة', 'وجبة عائلية تحتوي على برجر, بيتزا, بطاطس, ومشروبات', 350.00, 4, 2, 'uploads/family1.jpg', 'برجر, بيتزا, بطاطس, مشروبات'),
('صوص رانش', 'صوص رانش منزلي لتتبيل السلطات والبطاطس', 20.00, 4, 2, 'uploads/ranch1.jpg', 'صوص');

-- مطبخ الشيف أحمد (kitchen_id = 3) - 10 أطباق
INSERT INTO dishes (name, description, price, category_id, kitchen_id, image_url, ingredients) VALUES
('مندي لحم', 'مندي لحم غنم مطبوخ على طريقة الحجاز مع أرز بنكهة مميزة', 280.00, 1, 3, 'uploads/mandi1.jpg', 'مندي, لحم, أرز'),
('كبسة دجاج', 'كبسة دجاج سعودية مع أرز بسمتي وتوابل شرقية', 200.00, 1, 3, 'uploads/kabsa1.jpg', 'كبسة, دجاج, أرز, توابل'),
('مقلوبة', 'مقلوبة أردنية بالدجاج والأرز والخضار', 230.00, 1, 3, 'uploads/maqluba1.jpg', 'مقلوبة, دجاج, أرز, خضار'),
('صيادية سمك', 'صيادية سمك مصري بأرز مصري وصوص طماطم', 180.00, 3, 3, 'uploads/sayadia1.jpg', 'صيادية, سمك, أرز, صوص'),
('سمك مشوي', 'سمك فيليه مشوي مع خضار مشوية وصلصة ليمون', 220.00, 3, 3, 'uploads/fish1.jpg', 'سمك, خضار, صلصة'),
('جمبري بالكريمة', 'جمبري طازج مع كريمة وثوم وبقدونس', 250.00, 3, 3, 'uploads/shrimp1.jpg', 'جمبري, كريمة, ثوم, بقدونس'),
('باستا بالجمبري', 'باستا مع جمبري في صوص كريمي بالثوم', 180.00, 3, 3, 'uploads/pasta1.jpg', 'باستا, جمبري, صوص）, ثوم'),
('سلطة سيزر', 'سلطة سيزر كلاسيكية مع دجاج مشوي وخبز محمص', 80.00, 1, 3, 'uploads/caesar1.jpg', 'سلطة, دجاج, خضار, خبز'),
('حمة مشوية', 'لحم ضاني مشوي مع خضار مشوية وأرز', 320.00, 1, 3, 'uploads/grilled1.jpg', 'لحم, خضار, أرز'),
('كنافة بالقشطة', 'كنافة ناعمة بالقشطة والقطر والمكسرات', 90.00, 2, 3, 'uploads/kanafa2.jpg', 'كنافة, قشطة, قطر, مكسرات');

-- مطبخ فاطمة علي (kitchen_id = 4) - 10 أطباق
INSERT INTO dishes (name, description, price, category_id, kitchen_id, image_url, ingredients) VALUES
('تورتة الشوكولاتة', 'تورتة شوكولاتة غنية بطبقة جاناش وفراولة', 200.00, 2, 4, 'uploads/cake1.jpg', 'تورتة, شوكولاتة, فراولة'),
('تشيز كيك بالتوت', 'تشيز كيك كريمي مع صوص التوت الطازج', 180.00, 2, 4, 'uploads/cheesecake1.jpg', 'تشيز كيك, صوص, توت'),
('ماكارون فرنسي', 'ماكارون فرنسي بألوان ونكهات مختلفة', 120.00, 2, 4, 'uploads/macaron1.jpg', 'ماكارون, ألوان, نكهات'),
('بسبوسة بالسمن', 'بسبوسة تقليدية بالسمن البلدي والقطر', 70.00, 2, 4, 'uploads/basbousa2.jpg', 'بسبوسة, سمن, قطر'),
('مخبوزات مشكلة', 'مشكل من المعجنات والمخبوزات الطازجة', 150.00, 2, 4, 'uploads/pastries1.jpg', 'مخبوزات, معجنات'),
('كوكيز بالشوكولاتة', 'كوكيز طري مع قطع شوكولاتة غامقة', 50.00, 2, 4, 'uploads/cookies1.jpg', 'كوكيز, شوكولاتة'),
('بودينغ الفانيليا', 'بودينغ فانيليا كريمي مع صوص الكراميل', 80.00, 2, 4, 'uploads/pudding1.jpg', 'بودينغ, فانيليا, صوص'),
('موس الشوكولاتة', 'موس شوكولاتة خفيف مع كريمة مخفوقة', 90.00, 2, 4, 'uploads/mousse1.jpg', 'موس, شوكولاتة, كريمة'),
('فطائر التفاح', 'فطائر تفاح طازجة مع قرفة وسكر', 60.00, 2, 4, 'uploads/apple1.jpg', 'فطائر, تفاح, قرفة, سكر'),
('حلاوة طحينية بالمكسرات', 'حلاوة طحينية مع فستق وجوز', 55.00, 2, 4, 'uploads/halawa1.jpg', 'حلاوة, طحين, فستق, جوز');

-- ============================================
-- 6. إضافة التقييمات (5 مستخدمين لكل طبق من أول 10 أطباق)
-- ============================================
-- تم اختيار أول 10 أطباق (من مطبخ الست سارة)
-- و 5 مستخدمين لتقييم كل طبق

-- طبق 1: كيلو كفتة مشوية
INSERT INTO reviews (user_id, dish_id, rating, comment) VALUES
(5, 1, 5, 'أجمل كفتة أكلتها في حياتي! التسوية مظبوطة والطعم خرافي'),
(6, 1, 4, 'كفتة ممتازة بس كانت محتاجة ملح زيادة شوية'),
(7, 1, 5, 'لذيذة جداً, أنصح بها بشدة'),
(8, 1, 4, 'طعم رائع والتوصيل سريع'),
(9, 1, 5, 'أفضل كفتة في القاهرة, تسلم إيديكم');

-- طبق 2: طاجن بامية باللحمة
INSERT INTO reviews (user_id, dish_id, rating, comment) VALUES
(5, 2, 5, 'بامية ولا أروع, اللحمة ناضجة والطعم زي بيت أمي'),
(6, 2, 4, 'طاجن جميل بس كان محتاج صوص زيادة'),
(7, 2, 5, 'أفضل بامية أكلتها في مصر!'),
(8, 2, 3, 'جميلة بس اللحمة كانت قاسية شوية'),
(9, 2, 4, 'ممتازة, هكرر الطلب أكيد');

-- طبق 3: صينية بسبوسة بالمكسرات
INSERT INTO reviews (user_id, dish_id, rating, comment) VALUES
(5, 3, 5, 'بسبوسة دايبة وسكرها مظبوط, المكسرات طازجة'),
(6, 3, 5, 'أجمل بسبوسة في مصر, أنصح بها بشدة'),
(7, 3, 4, 'رائعة بس كانت حلوة شوية'),
(8, 3, 5, 'بسبوسة بمذاق لا ينسى'),
(9, 3, 4, 'جميلة جداً, هكرر الطلب');

-- طبق 4: محشي ورق عنب
INSERT INTO reviews (user_id, dish_id, rating, comment) VALUES
(5, 4, 5, 'ورق عنب ممتاز, الحشوة لذيذة والصلصة رائعة'),
(6, 4, 4, 'جميل بس كان محتاج حمضية زيادة'),
(7, 4, 5, 'أجمل محشي في المنطقة'),
(8, 4, 3, 'جيد لكن ورق العنب كان قاسي شوية'),
(9, 4, 5, 'ممتاز جداً, الطعم أصيل');

-- طبق 5: طاجن مسقعة بالبشاميل
INSERT INTO reviews (user_id, dish_id, rating, comment) VALUES
(5, 5, 5, 'مسقعة ولا أحلى, البشاميل رائع'),
(6, 5, 4, 'لذيذة, بس كانت بحاجة ملح زيادة'),
(7, 5, 5, 'أفضل مسقعة في المدينة'),
(8, 5, 4, 'ممتازة جداً'),
(9, 5, 5, 'رائعة, هطلبه تاني أكيد');

-- طبق 6: كنافة نابلسية
INSERT INTO reviews (user_id, dish_id, rating, comment) VALUES
(5, 6, 5, 'كنافة خرافية, الجبنة والقطر والمكسرات كلهم ممتازين'),
(6, 6, 5, 'أجمل كنافة في مصر'),
(7, 6, 4, 'رائعة بس كانت حلوة شوية'),
(8, 6, 5, 'كنافة بمذاق لا ينسى'),
(9, 6, 4, 'جميلة جداً');

-- طبق 7: شاورما سوري
INSERT INTO reviews (user_id, dish_id, rating, comment) VALUES
(5, 7, 5, 'شاورما ولا أروع, اللحم طري والتتبيلة ممتازة'),
(6, 7, 4, 'رائعة بس الخبز كان جامد شوية'),
(7, 7, 5, 'أفضل شاورما في القاهرة'),
(8, 7, 4, 'جميلة, هكرر الطلب'),
(9, 7, 5, 'شاورما رائعة جداً');

-- طبق 8: أم علي
INSERT INTO reviews (user_id, dish_id, rating, comment) VALUES
(5, 8, 5, 'أم علي رائعة, القشطة والمكسرات ممتازين'),
(6, 8, 5, 'أجمل أم علي في مصر'),
(7, 8, 4, 'لذيذة جداً بس السكر كان زيادة'),
(8, 8, 5, 'رائعة, أنصح بها بشدة'),
(9, 8, 4, 'جميلة جداً');

-- طبق 9: فتة باللحم
INSERT INTO reviews (user_id, dish_id, rating, comment) VALUES
(5, 9, 5, 'فتة ممتازة, اللحم ناضج والصلصة رائعة'),
(6, 9, 4, 'رائعة بس الخبز كان طري شوية'),
(7, 9, 5, 'أفضل فتة في المدينة'),
(8, 9, 4, 'ممتازة جداً'),
(9, 9, 5, 'فتة ولا أحلى');

-- طبق 10: ممبار
INSERT INTO reviews (user_id, dish_id, rating, comment) VALUES
(5, 10, 5, 'ممبار رائع, الحشوة لذيذة والتسوية ممتازة'),
(6, 10, 4, 'جميل بس كان محتاج صوص زيادة'),
(7, 10, 5, 'أجمل ممبار في القاهرة'),
(8, 10, 3, 'جيد لكن الحشوة كانت ناشفة شوية'),
(9, 10, 5, 'ممبار ولا أحلى');

-- ============================================
-- 7. إضافة تقييمات إضافية لأطباق عشوائية
-- ============================================
-- أطباق من مطبخ برجر آند كو
INSERT INTO reviews (user_id, dish_id, rating, comment) VALUES
(6, 11, 5, 'تشيز برجر ولا أروع, اللحم طازج والجبنة ممتازة'),
(7, 12, 4, 'برجر كلاسيك رائع بس كان محتاج صوص زيادة'),
(8, 13, 5, 'بيتزا مارجريتا ممتازة جداً'),
(9, 14, 4, 'بيتزا بيبروني لذيذة'),
(5, 15, 5, 'بطاطس ولا أحلى, التتبيلة ممتازة');

-- أطباق من مطبخ الشيف أحمد
INSERT INTO reviews (user_id, dish_id, rating, comment) VALUES
(6, 21, 5, 'مندي لحم رائع, الأرز واللحم ممتازين'),
(7, 22, 4, 'كبسة دجاج جميلة جداً'),
(8, 23, 5, 'مقلوبة ولا أروع'),
(9, 24, 4, 'صيادية سمك ممتازة'),
(5, 25, 5, 'سمك مشوي رائع جداً');

-- أطباق من مطبخ فاطمة علي
INSERT INTO reviews (user_id, dish_id, rating, comment) VALUES
(6, 31, 5, 'تورتة شوكولاتة خرافية'),
(7, 32, 5, 'تشيز كيك بالتوت ممتاز جداً'),
(8, 33, 4, 'ماكارون فرنسي رائع'),
(9, 34, 5, 'بسبوسة بالسمن ولا أحلى'),
(5, 35, 4, 'مخبوزات مشكلة جميلة جداً');