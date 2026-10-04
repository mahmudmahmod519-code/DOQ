const Joi = require('joi');

/**
 * جميع مخططات التحقق (Validation Schemas) لمنصة دوق
 * متوافقة مع هيكل قاعدة البيانات المحدد
 */
const userSchema = Joi.object({
    firstname: Joi.string()
        .min(2)
        .max(50)
        .required()
        .trim()
        .pattern(/^[\u0600-\u06FFa-zA-Z\s]+$/)
        .messages({
            'string.min': 'الاسم الأول يجب أن يكون على الأقل حرفين',
            'string.max': 'الاسم الأول يجب أن لا يتجاوز 50 حرف',
            'string.pattern.base': 'الاسم الأول يجب أن يحتوي على أحرف فقط',
            'any.required': 'الاسم الأول مطلوب'
        }),
    lastname: Joi.string()
        .min(2)
        .max(50)
        .required()
        .trim()
        .pattern(/^[\u0600-\u06FFa-zA-Z\s]+$/)
        .messages({
            'string.min': 'الاسم الأخير يجب أن يكون على الأقل حرفين',
            'string.max': 'الاسم الأخير يجب أن لا يتجاوز 50 حرف',
            'string.pattern.base': 'الاسم الأخير يجب أن يحتوي على أحرف فقط',
            'any.required': 'الاسم الأخير مطلوب'
        }),
    phone_number: Joi.string()
        .required()
        .trim()
        .length(11)
        .pattern(/^(010|011|012|015)[0-9]{8}$/)
        .messages({
            'string.pattern.base': 'رقم الهاتف يجب أن يكون رقم مصري صحيح (مثل: 01012345678)',
            'any.required': 'رقم الهاتف مطلوب'
        }),
    email: Joi.string()
        .email()
        .required()
        .trim()
        .lowercase()
        .max(100)
        .messages({
            'string.email': 'البريد الإلكتروني غير صحيح',
            'any.required': 'البريد الإلكتروني مطلوب',
            'string.max': 'البريد الإلكتروني يجب أن لا يتجاوز 100 حرف'
        }),
    password: Joi.string()
        .min(8)
        .max(255)
        .required()
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
        .messages({
            'string.min': 'كلمة المرور يجب أن تكون على الأقل 8 أحرف',
            'string.max': 'كلمة المرور يجب أن لا تتجاوز 255 حرف',
            'string.pattern.base': 'كلمة المرور يجب أن تحتوي على حرف كبير، حرف صغير، رقم، ورمز خاص',
            'any.required': 'كلمة المرور مطلوبة'
        }),
    password_confirmation: Joi.string()
        .valid(Joi.ref('password'))
        .required()
        .messages({
            'any.only': 'تأكيد كلمة المرور غير متطابق',
            'any.required': 'تأكيد كلمة المرور مطلوب'
        }),
    // ✅ إضافة role - customer أو chef فقط (admin من الـ admin فقط)
    roles: Joi.string()
        .valid('customer', 'chef', 'delivery')
        .default('customer')
        .messages({
            'any.only': 'الدور يجب أن يكون: customer أو chef أو delivery'
        }),
    company_name: Joi.string().max(120).trim().allow('', null),
    enable_2fa: Joi.alternatives().try(Joi.boolean(), Joi.string().valid('0', '1', 'on', 'off')).default(false),
        
    city: Joi.string()
        .max(100)
        .trim()
        .allow('', null)
        .messages({
            'string.max': 'اسم المدينة يجب أن لا يتجاوز 100 حرف'
        }),
    
    address: Joi.string()
        .max(255)
        .trim()
        .allow('', null)
        .messages({
            'string.max': 'العنوان يجب أن لا يتجاوز 255 حرف'
        }),
    
    secretKey: Joi.string().allow('', null)
    .trim()
    .uppercase()
    .pattern(/^[A-Z2-7]{16,32}=*$/)
    .messages({
        'string.pattern.base': 'الـ Secret غير صحيح ويجب أن يكون بصيغة Base32'
    })

});

const createAdminUserSchema = Joi.object({
    firstname: Joi.string().min(2).max(50).required().trim().messages({
        'string.min': 'الاسم الأول يجب أن يكون على الأقل حرفين',
        'any.required': 'الاسم الأول مطلوب'
    }),
    lastname: Joi.string().min(2).max(50).required().trim().messages({
        'string.min': 'اسم العائلة يجب أن يكون على الأقل حرفين',
        'any.required': 'اسم العائلة مطلوب'
    }),
    email: Joi.string().email().required().trim().lowercase().messages({
        'string.email': 'البريد الإلكتروني غير صحيح',
        'any.required': 'البريد الإلكتروني مطلوب'
    }),
    phone_number: Joi.string().length(11).trim().pattern(/^(010|011|012|015)[0-9]{8}$/).required().messages({
        'string.pattern.base': 'رقم الهاتف يجب أن يكون رقم مصري صحيح',
        'any.required': 'رقم الهاتف مطلوب'
    }),
    password: Joi.string().min(8).max(255).required().pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/).messages({
        'string.pattern.base': 'كلمة المرور يجب أن تحتوي على حرف كبير، حرف صغير، رقم، ورمز خاص',
        'any.required': 'كلمة المرور مطلوبة'
    }),
    roles: Joi.string().valid('customer', 'chef', 'delivery').default('customer').messages({
        'any.only': 'الدور يجب أن يكون عميل أو شيف أو شركة دليفري'
    })
});

const signUp2Schema = Joi.object({
    otp: Joi.string()
        .length(6)
        .required()
        .pattern(/^[0-9]{6}$/)
        .messages({
            'string.length': 'رمز التحقق يجب أن يكون 6 أرقام',
            'string.pattern.base': 'رمز التحقق يجب أن يحتوي على أرقام فقط',
            'any.required': 'رمز التحقق مطلوب'
        })
});


const userUpdateSchema = Joi.object({
    first_name: Joi.string()
        .min(2)
        .max(50)
        .trim()
        .pattern(/^[\u0600-\u06FFa-zA-Z\s]+$/),
    
    last_name: Joi.string()
        .min(2)
        .max(50)
        .trim()
        .pattern(/^[\u0600-\u06FFa-zA-Z\s]+$/),
    
    phone_number: Joi.string()
        .length(11)
        .trim()
        .pattern(/^(010|011|012|015)[0-9]{8}$/),    
    // email: Joi.string()
    //     .email()
    //     .trim()
    //     .lowercase()
    //     .max(100),
    city: Joi.string()
        .max(100)
        .trim()
        .allow('', null)
        .messages({
            'string.max': 'اسم المدينة يجب أن لا يتجاوز 100 حرف'
        }),
    
    address: Joi.string()
        .max(255)
        .trim()
        .allow('', null)
        .messages({
            'string.max': 'العنوان يجب أن لا يتجاوز 255 حرف'
        }),
    
    roles: Joi.string()
        .valid('customer', 'chef', 'delivery', 'admin')
});

const loginSchema = Joi.object({
    email: Joi.string()
        .email()
        .required()
        .trim()
        .lowercase()
        .messages({
            'string.email': 'البريد الإلكتروني غير صحيح',
            'any.required': 'البريد الإلكتروني مطلوب'
        }),
    
    password: Joi.string()
        .required()
        .messages({
            'any.required': 'كلمة المرور مطلوبة'
        })
});

const categorySchema = Joi.object({
    name: Joi.string()
        .min(2)
        .max(100)
        .required()
        .trim()
        .messages({
            'string.min': 'اسم التصنيف يجب أن يكون على الأقل حرفين',
            'string.max': 'اسم التصنيف يجب أن لا يتجاوز 100 حرف',
            'any.required': 'اسم التصنيف مطلوب'
        }),
    
    description: Joi.string()
        .max(1000)
        .trim()
        .allow('', null)
        .messages({
            'string.max': 'الوصف يجب أن لا يتجاوز 1000 حرف'
        })
});

const kitchenSchema = Joi.object({
    title: Joi.string()
        .min(3)
        .max(100)
        .required()
        .trim()
        .messages({
            'string.min': 'عنوان المطبخ يجب أن يكون على الأقل 3 أحرف',
            'string.max': 'عنوان المطبخ يجب أن لا يتجاوز 100 حرف',
            'any.required': 'عنوان المطبخ مطلوب'
        }),
    
    description: Joi.string()
        .max(2000)
        .trim()
        .allow('', null)
        .messages({
            'string.max': 'وصف المطبخ يجب أن لا يتجاوز 2000 حرف'
        }),
    
    city: Joi.string()
        .max(100)
        .trim()
        .allow('', null)
        .messages({
            'string.max': 'اسم المدينة يجب أن لا يتجاوز 100 حرف'
        }),
    
    address: Joi.string()
        .max(255)
        .trim()
        .allow('', null)
        .messages({
            'string.max': 'العنوان يجب أن لا يتجاوز 255 حرف'
        }),
    
    phone_number: Joi.string()
        .required()
        .trim()
        .length(11)
        .pattern(/^(010|011|012|015)[0-9]{8}$/)
        .messages({
            'string.pattern.base': 'رقم الهاتف يجب أن يكون رقم مصري صحيح',
            'any.required': 'رقم الهاتف مطلوب'
        })
        
    // user_id: Joi.number()
    //     .integer()
    //     .positive()
    //     .required()
    //     .messages({
    //         'number.base': 'معرف المستخدم يجب أن يكون رقم',
    //         'number.positive': 'معرف المستخدم يجب أن يكون رقم موجب',
    //         'any.required': 'معرف المستخدم مطلوب'
    //     })
});


const kitchenUpdateSchema = Joi.object({
    title: Joi.string()
        .min(3)
        .max(100)
        .trim(),
    
    description: Joi.string()
        .max(2000)
        .trim()
        .allow('', null),
    
    city: Joi.string()
        .max(100)
        .trim()
        .allow('', null),
    
    address: Joi.string()
        .max(255)
        .trim()
        .allow('', null),
    
    
    phone_number: Joi.string()
        .trim()
        .length(11)
        .pattern(/^(010|011|012|015)[0-9]{8}$/),

    kitchen_id: Joi.number()
        .integer()
        .positive()
        .required()
        .messages({
            'number.base': 'معرف المطبخ يجب أن يكون رقم',
            'number.positive': 'معرف المطبخ يجب أن يكون رقم موجب',
            'any.required': 'معرف المطبخ مطلوب'
        })
});

const dishSchema = Joi.object({
    name: Joi.string()
        .min(2)
        .max(100)
        .required()
        .trim()
        .messages({
            'string.min': 'اسم الأكلة يجب أن يكون على الأقل حرفين',
            'string.max': 'اسم الأكلة يجب أن لا يتجاوز 100 حرف',
            'any.required': 'اسم الأكلة مطلوب'
        }),
    
    description: Joi.string()
        .max(2000)
        .trim()
        .allow('', null)
        .messages({
            'string.max': 'وصف الأكلة يجب أن لا يتجاوز 2000 حرف'
        }),
    
    ingredients: Joi.string()
        .max(1000)
        .trim()
        .allow('', null)
        .messages({
            'string.max': 'وصف المكونات يجب أن لا يتجاوز 1000 حرف'
        }),

    price: Joi.number()
        .precision(2)
        .min(0)
        .max(10000)
        .required()
        .messages({
            'number.base': 'السعر يجب أن يكون رقم',
            'number.min': 'السعر يجب أن يكون 0 على الأقل',
            'number.max': 'السعر يجب أن لا يتجاوز 10000 جنيه',
            'any.required': 'السعر مطلوب'
        }),
    
    image_url: Joi.string()
        .uri()
        .max(255)
        .allow('', null)
        .messages({
            'string.uri': 'رابط الصورة غير صحيح',
            'string.max': 'رابط الصورة يجب أن لا يتجاوز 255 حرف'
        }),
    
    category_id: Joi.number()
        .integer()
        .positive()
        .required()
        .messages({
            'number.base': 'معرف التصنيف يجب أن يكون رقم',
            'number.positive': 'معرف التصنيف يجب أن يكون رقم موجب',
            'any.required': 'معرف التصنيف مطلوب'
        }),
    
    kitchen_id: Joi.number()
        .integer()
        .positive()
        .required()
        .messages({
            'number.base': 'معرف المطبخ يجب أن يكون رقم',
            'number.positive': 'معرف المطبخ يجب أن يكون رقم موجب',
            'any.required': 'معرف المطبخ مطلوب'
        })
});


const dishUpdateSchema = Joi.object({
    name: Joi.string()
        .min(2)
        .max(100)
        .trim(),
    
    description: Joi.string()
        .max(2000)
        .trim()
        .allow('', null),
        
    ingredients: Joi.string()
     .max(1000)
     .trim()
     .allow('', null)
     .messages({
         'string.max': 'وصف المكونات يجب أن لا يتجاوز 1000 حرف'
     }),

    price: Joi.number()
        .precision(2)
        .min(0)
        .max(10000),
    
    image_url: Joi.string()
        .uri()
        .max(255)
        .allow('', null),
    
    category_id: Joi.number()
        .integer()
        .positive(),
    
    kitchen_id: Joi.number()
        .integer()
        .positive()
    
});

const reviewSchema = Joi.object({
    // user_id: Joi.number()
    //     .integer()
    //     .positive()
    //     .required()
    //     .messages({
    //         'number.base': 'معرف المستخدم يجب أن يكون رقم',
    //         'number.positive': 'معرف المستخدم يجب أن يكون رقم موجب',
    //         'any.required': 'معرف المستخدم مطلوب'
    //     }),
    
    dish_id: Joi.number()
        .integer()
        .positive()
        .required()
        .messages({
            'number.base': 'معرف الأكلة يجب أن يكون رقم',
            'number.positive': 'معرف الأكلة يجب أن يكون رقم موجب',
            'any.required': 'معرف الأكلة مطلوب'
        }),
    
    rating: Joi.number()
        .integer()
        .min(1)
        .max(5)
        .required()
        .messages({
            'number.base': 'التقييم يجب أن يكون رقم',
            'number.min': 'التقييم يجب أن يكون 1 على الأقل',
            'number.max': 'التقييم يجب أن لا يتجاوز 5',
            'any.required': 'التقييم مطلوب'
        }),
    
    comment: Joi.string()
        .max(1000)
        .trim()
        .allow('', null)
        .messages({
            'string.max': 'التعليق يجب أن لا يتجاوز 1000 حرف'
        })
});

const reviewUpdateSchema = Joi.object({
    rating: Joi.number()
        .integer()
        .min(1)
        .max(5),
    
    comment: Joi.string()
        .max(1000)
        .trim()
        .allow('', null)
});

const reviewsListQuerySchema = Joi.object({
    type: Joi.string().valid('dish', 'kitchen').optional(),
    id: Joi.number().integer().positive().optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(10),
    q: Joi.string().trim().allow('', null).max(200).optional(),
    rating: Joi.number().integer().min(1).max(5).optional(),
    sort_order: Joi.string().valid('ASC', 'DESC', 'asc', 'desc').default('DESC').optional(),
    city: Joi.string().trim().allow('', null).optional(),
    category: Joi.string().trim().allow('', null).optional()
}).unknown(true);

const searchQuerySchema = Joi.object({

    q: Joi.string()
        .optional()
        .max(100)
        .trim()
        .allow('', null)
        .messages({
            'string.base': 'كلمة البحث يجب أن تكون نصاً.',
            'string.max': 'كلمة البحث يجب ألا تتجاوز 100 حرف.'
        }),
    
    city: Joi.string()
        .optional()
        .max(100)
        .trim()
        .allow('', null)
        .messages({
            'string.base': 'اسم المدينة يجب أن يكون نصاً.',
            'string.max': 'اسم المدينة يجب ألا يتجاوز 100 حرف.'
        }),
    
    category: Joi.string()
        .optional()
        .max(100)
        .trim()
        .allow('', null)
        .messages({
            'string.base': 'اسم القسم يجب أن يكون نصاً.',
            'string.max': 'اسم القسم يجب ألا يتجاوز 100 حرف.'
        }),
    
    min_price: Joi.number()
        .min(0)
        .max(10000)
        .messages({
            'number.base': 'الحد الأدنى للسعر يجب أن يكون رقماً.',
            'number.min': 'الحد الأدنى للسعر لا يمكن أن يكون أقل من 0.',
            'number.max': 'الحد الأدنى للسعر لا يمكن أن يتجاوز 10000.'
        }),
    
    max_price: Joi.number()
        .min(0)
        .max(10000)
        .messages({
            'number.base': 'الحد الأقصى للسعر يجب أن يكون رقماً.',
            'number.min': 'الحد الأقصى للسعر لا يمكن أن يكون أقل من 0.',
            'number.max': 'الحد الأقصى للسعر لا يمكن أن يتجاوز 10000.'
        }),
    
    rating: Joi.number()
        .optional()
        .min(1)
        .max(5)
        .messages({
            'number.base': 'التقييم يجب أن يكون رقماً.',
            'number.min': 'التقييم لا يمكن أن يكون أقل من نجمة واحدة.',
            'number.max': 'التقييم لا يمكن أن يتجاوز 5 نجوم.'
        }),
    
    page: Joi.number()
        .integer()
        .min(1)
        .default(1)
        .messages({
            'number.base': 'رقم الصفحة يجب أن يكون رقماً.',
            'number.integer': 'رقم الصفحة يجب أن يكون رقماً صحيحاً.',
            'number.min': 'رقم الصفحة يجب أن يكون 1 على الأقل.'
        }),
    
    limit: Joi.number()
        .integer()
        .min(1)
        .max(50)
        .default(10)
        .messages({
            'number.base': 'عدد العناصر (limit) يجب أن يكون رقماً.',
            'number.integer': 'عدد العناصر يجب أن يكون رقماً صحيحاً.',
            'number.min': 'عدد العناصر يجب أن يكون 1 على الأقل.',
            'number.max': 'عدد العناصر في الصفحة الواحدة لا يمكن أن يتجاوز 50.'
        }),
    
    sort_by: Joi.string()
        .valid('created_at', 'price', 'rating', 'name')
        .default('created_at')
        .messages({
            'string.base': 'معيار الترتيب يجب أن يكون نصاً.',
            'any.only': 'معيار الترتيب يجب أن يكون واحداً من القيم التالية: (created_at, price, rating, name).'
        }),
    
    sort_order: Joi.string()
        .valid('ASC', 'DESC')
        .default('DESC')
        .messages({
            'string.base': 'نوع الترتيب يجب أن يكون نصاً.',
            'any.only': 'نوع الترتيب يجب أن يكون تصاعدي (ASC) أو تنازلي (DESC).'
        }),
    type: Joi.string().empty(),
    id: Joi.number().empty(),
    include_stats: Joi.boolean().empty(),
    kitchen_id: Joi.number().empty(),

});


const idParamSchema = Joi.object({
    id: Joi.number()
        .integer()
        .positive()
        .required()
        .messages({
            'number.base': 'المعرف يجب أن يكون رقم',
            'number.positive': 'المعرف يجب أن يكون رقم موجب',
            'any.required': 'المعرف مطلوب'
        })
});

const changePasswordSchema = Joi.object({
    otp: Joi.string()
        .length(6)
        .required()
        .pattern(/^[0-9]{6}$/)
        .messages({
            'string.length': 'رمز التحقق يجب أن يكون 6 أرقام',
            'string.pattern.base': 'رمز التحقق يجب أن يحتوي على أرقام فقط',
            'any.required': 'رمز التحقق مطلوب'
        }),
    
 
    current_password: Joi.string()
        .required()
        .messages({
            'any.required': 'كلمة المرور الحالية مطلوبة'
        }),
    
    new_password: Joi.string()
        .min(8)
        .max(255)
        .required()
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
        .messages({
            'string.min': 'كلمة المرور الجديدة يجب أن تكون على الأقل 8 أحرف',
            'string.pattern.base': 'كلمة المرور يجب أن تحتوي على حرف كبير، حرف صغير، رقم، ورمز خاص',
            'any.required': 'كلمة المرور الجديدة مطلوبة'
        }),
    
    confirm_password: Joi.string()
        .valid(Joi.ref('new_password'))
        .required()
        .messages({
            'any.only': 'تأكيد كلمة المرور غير متطابق',
            'any.required': 'تأكيد كلمة المرور مطلوب'
        })
});


// number save it in database to change password if want
const forgetPassword = Joi.object({
    otp: Joi.string()
        .length(6)
        .required()
        .pattern(/^[0-9]{6}$/)
        .messages({
            'string.length': 'رمز التحقق يجب أن يكون 6 أرقام',
            'string.pattern.base': 'رمز التحقق يجب أن يحتوي على أرقام فقط',
            'any.required': 'رمز التحقق مطلوب'
        }),
    
    email: Joi.string()
        .email()
        .required()
        .trim()
        .lowercase()
        .messages({
            'string.email': 'البريد الإلكتروني غير صحيح',
            'any.required': 'البريد الإلكتروني مطلوب'
        }),
    
    new_password: Joi.string()
        .min(8)
        .max(255)
        .required()
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
        .messages({
            'string.min': 'كلمة المرور الجديدة يجب أن تكون على الأقل 8 أحرف',
            'string.max': 'كلمة المرور الجديدة يجب أن لا تتجاوز 255 حرف',
            'string.pattern.base': 'كلمة المرور يجب أن تحتوي على حرف كبير، حرف صغير، رقم، ورمز خاص',
            'any.required': 'كلمة المرور الجديدة مطلوبة'
        }),
    
    confirm_password: Joi.string()
        .valid(Joi.ref('new_password'))
        .required()
        .messages({
            'any.only': 'تأكيد كلمة المرور غير متطابق',
            'any.required': 'تأكيد كلمة المرور مطلوب'
        })
});

module.exports = {
    signUp2Schema,
    userSchema,
    createAdminUserSchema,
    userUpdateSchema,
    loginSchema,
    changePasswordSchema,
    forgetPassword,
    
    categorySchema,
    
    kitchenSchema,
    kitchenUpdateSchema,
    
    dishSchema,
    dishUpdateSchema,
    
    reviewSchema,
    reviewUpdateSchema,
    reviewsListQuerySchema,
    
    searchQuerySchema,
    
    idParamSchema,
    
};
