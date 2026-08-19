const swaggerAutogen = require('swagger-autogen')();
const joiToSwagger = require('joi-to-swagger');
const { 
    loginSchema, 
    userSchema, 
    forgetPassword,
    changePasswordSchema,
    categorySchema,
    dishSchema,
dishUpdateSchema,
idParamSchema,
kitchenSchema,
kitchenUpdateSchema,
reviewSchema,
reviewUpdateSchema,
searchQuerySchema,
userUpdateSchema
} = require("./validation");

module.exports=()=>{



const { swagger: loginSwagger } = joiToSwagger(loginSchema);
const { swagger: userSwagger } = joiToSwagger(userSchema);
const { swagger: forgetSwagger } = joiToSwagger(forgetPassword);
const { swagger: changePasswordSwagger } = joiToSwagger(changePasswordSchema);
const { swagger: categorySwagger } = joiToSwagger(categorySchema);
const { swagger: dishSwagger } = joiToSwagger(dishSchema);
const { swagger: dishUpdateSwagger } = joiToSwagger(dishUpdateSchema);
const { swagger: idParamSwagger } = joiToSwagger(idParamSchema);
const { swagger: kitchenSwagger } = joiToSwagger(kitchenSchema);
const { swagger: kitchenUpdateSwagger } = joiToSwagger(kitchenUpdateSchema);
const { swagger: reviewSwagger } = joiToSwagger(reviewSchema);
const { swagger: reviewUpdateSwagger } = joiToSwagger(reviewUpdateSchema);
const { swagger: searchQuerySwagger } = joiToSwagger(searchQuerySchema);
const { swagger: userUpdateSwagger } = joiToSwagger(userUpdateSchema);

const doc = {
  info: {
    title: 'My Auth API',
    description: 'Auto-generated API Documentation with Joi Validation',
  },
  host: 'localhost:3000',
  schemes: ['http'],
  definitions: {
    LoginInput: loginSwagger,
    SignupInput: userSwagger,
    ForgetPasswordInput: forgetSwagger,
    ChangePasswordInput: changePasswordSwagger,
    CategoryInput: categorySwagger,
    DishInput: dishSwagger,
    DishUpdateInput: dishUpdateSwagger,
    IdParam: idParamSwagger,
    KitchenInput: kitchenSwagger,
    KitchenUpdateInput: kitchenUpdateSwagger,
    ReviewInput: reviewSwagger,
    ReviewUpdateInput: reviewUpdateSwagger,
    SearchQuery: searchQuerySwagger,
    UserUpdateInput: userUpdateSwagger
  }
};

const outputFile = './swagger.json';
const endpointsFiles = ['./routes/auth.js'];// add document here

swaggerAutogen(outputFile, endpointsFiles, doc);
}