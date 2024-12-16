const request = require("supertest");
const app = require("./app"); // Correct path to app
const mockingoose = require("mockingoose");
const User = require("./models/user"); // Correct path to User model

describe("POST /users/signup", () => {
  beforeEach(() => {
    mockingoose.resetAll();
  });

  test("Créer un utilisateur avec des données valides", async () => {
    // Simule qu'aucun utilisateur n'existe déjà
    mockingoose(User).toReturn(null, "findOne");
    // Simule la sauvegarde réussie
    mockingoose(User).toReturn(
      {
        username: "JohnDoe",
        email: "johndoe@example.com",
        token: "random-token",
        avatarUrl: "map-pin-yellow",
      },
      "save"
    );

    const res = await request(app)
      .post("/users/signup") 
      .send({
        username: "JohnDoe",
        password: "securePassword123",
        email: "johndoe@example.com",
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.result).toBe(true);
    expect(res.body.token).toBe("random-token");
    expect(res.body.avatarUrl).toBe("map-pin-yellow");
  });

  test("Retourne une erreur si des champs sont manquants", async () => {
    const res = await request(app)
      .post("/users/signup")
      .send({
        username: "JohnDoe",
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.result).toBe(false);
    expect(res.body.error).toBe("Missing or empty fields");
  });

  test("Retourne une erreur si l'email existe déjà", async () => {
    // Simule un utilisateur existant
    mockingoose(User).toReturn({ email: "johndoe@example.com" }, "findOne");

    const res = await request(app)
      .post("/users/signup") 
      .send({
        username: "JohnDoe",
        password: "securePassword123",
        email: "johndoe@example.com",
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.result).toBe(false);
    expect(res.body.error).toBe("Email already exists");
  });
});
