import { Injectable, UnauthorizedException } from "@nestjs/common";
import { InjectModel } from "nestjs-typegoose";
import { IInfoPrivate, IUserGood, UserModel } from "./user.model";
import { UserDto } from "./dto/user.dto";
import { ModelType } from "@typegoose/typegoose/lib/types";
import { JwtService } from "@nestjs/jwt";
import { genSalt, hash, compare } from "bcryptjs";
import { AuthDto } from "./dto/auth.dto";
import { USER_NOT_FOUND_ERROR, WRONG_PASSWORD_ERROR } from "./user.constant";
import { GoodModel } from "src/good/good.model";

@Injectable()
export class UserService {
  constructor(
    @InjectModel(UserModel) private readonly userModel: ModelType<UserModel>,
    private readonly jwtService: JwtService,
    @InjectModel(GoodModel) private readonly goodModel: ModelType<GoodModel>,
  ) {}

  async registerUser(dto: AuthDto) {
    const salt = await genSalt(10);
    const newUser = await this.userModel.create({
      publik: {
        name: dto.name,
        city: "",
        age: "",
      },
      private: {
        phone: dto.phone || "",
        dataofBirt: dto.dataofBirth || "",
        role: "user",
        email: dto.email,
        passwordHash: await hash(dto.password, salt),
      },
      favorites: [],
      basket: [],
      order: [],
      delivery: {
        address: "",
        pickUpPoin: "",
        choice: "",
      },
    });
    return newUser.save();
  }

  async findUser(email: string) {
    return this.userModel.findOne({ "private.email": email }).exec();
  }

  async validateUser(
    email: string,
    password: string,
  ): Promise<Pick<IInfoPrivate, "email">> {
    const user = await this.findUser(email);
    if (!user) {
      throw new UnauthorizedException(USER_NOT_FOUND_ERROR);
    }
    const isCorrectPassword = await compare(
      password,
      user.private.passwordHash,
    );
    if (!isCorrectPassword) {
      throw new UnauthorizedException(WRONG_PASSWORD_ERROR);
    }
    return { email: user.private.email };
  }

  async login(email: string) {
    const payload = { email };
    return {
      access_token: await this.jwtService.signAsync(payload),
    };
  }

  async create(dto: UserDto) {
    this.userModel.create(dto);
  }

  // Костыльная реализация - необходимо исправить в будущем на сложную агрегацию
  // Данный метод плох тем, что делает 2 запроса к бд
  // Первый запрос идет на получение записи из юзера и затем делает ещё один запрос к записям Good для соотнесения данных
  // Необходимо ПЕРЕДЕЛАТЬ В БУДУЩЕМ!!!
  async getData(email: string, field: string) {
    const user = await this.userModel
      .findOne({ "private.email": email }, { [field]: 1 })
      .exec();
    if (!user || !user[field] || user[field].length === 0) {
      return [];
    }

    const arrItems = await this.goodModel
      .find({ _id: { $in: user[field].map((item) => item.goodId) } })
      .exec();

    const result = arrItems.map((item) => {
      const userData = user[field].find(
        (i) => item._id.toString() === i.goodId,
      );
      return {
        ...item.toObject(),
        count: userData.count,
        favorite: userData.favorite,
      };
    });
    return result;
  }

  async getBasket(email: string) {
    return this.getData(email, "basket");
  }

  async getFavorites(email: string) {
    return this.getData(email, "favorites");
  }

  async getOrders(email: string) {
    return this.getData(email, "order");
  }

  async getUserData(id: string) {
    this.userModel.findOne({ id }, { publik: 1, private: 1, delivery: 1 });
  }
  async updateUserData(dto: UserDto, id: string) {
    const updatedUser = await this.userModel.findOneAndUpdate(
      { _id: id },
      {
        $set: {
          publik: dto.publik,
          private: dto.private,
          delivery: dto.delivery,
        },
      },
      { new: true },
    );

    return updatedUser;
  }

  async updateGoodToBasket(email: string, goodId: string, operand = "add") {
    let operator = "add";
    if (operand === "sub") {
      operator = "subtract";
    }

    await this.userModel.updateOne({ "private.email": email }, [
      {
        $set: {
          isExisting: { $in: [goodId, "$basket.goodId"] },
          existingItem: {
            $filter: {
              input: "$basket",
              as: "item",
              cond: { $eq: ["$$item.goodId", goodId] },
            },
          },
        },
      },
      {
        $set: {
          basket: {
            $cond: {
              if: "$isExisting",
              then: {
                $cond: {
                  if: {
                    $and: [
                      // { $lt: [ { $arrayElemAt: ["$existingItem", 0] }, 2 ] },
                      {
                        $lt: [
                          {
                            $first: {
                              $map: {
                                input: "$existingItem",
                                as: "item",
                                in: "$$item.count",
                              },
                            },
                          },
                          2,
                        ],
                      },
                      { $eq: [operator, "subtract"] },
                    ],
                  },
                  then: {
                    $filter: {
                      input: "$basket",
                      as: "item",
                      cond: { $ne: ["$$item.goodId", goodId] },
                    },
                  },
                  else: {
                    $map: {
                      input: "$basket",
                      as: "item",
                      in: {
                        $cond: {
                          if: { $eq: ["$$item.goodId", goodId] },
                          then: {
                            goodId: "$$item.goodId",
                            count: { [`$${operator}`]: ["$$item.count", 1] },
                          },
                          else: "$$item",
                        },
                      },
                    },
                  },
                },
              },
              else: {
                $cond: {
                  if: { $eq: [operand, "add"] },
                  then: {
                    $concatArrays: ["$basket", [{ goodId: goodId, count: 1 }]],
                  },
                  else: "$basket",
                },
              },
            },
          },
        },
      },
      {
        $unset: ["isExisting", "existingItem"],
      },
    ]);
  }

  async deleteGood(email: string, id: string, field: string) {
    return await this.userModel.updateOne(
      { "private.email": email },
      { $pull: { [field]: { goodId: id } } },
    );
  }

  async addBasket(email: string, id: string) {
    return this.updateGoodToBasket(email, id);
  }
  async toggleFavorites(email: string, goodId: string) {
    await this.userModel.updateOne({ "private.email": email }, [
      {
        $set: {
          isExisting: { $in: [goodId, "$favorites"] },
        },
      },
      {
        $set: {
          favorites: {
            $cond: {
              if: "$isExisting",
              then: { $setDifference: ["$favorites", [goodId]] },
              else: { $concatArrays: ["$favorites", [goodId]] },
            },
          },
        },
      },
      {
        $unset: "isExisting", // Удаляем временное поле isExisting
      },
    ]);
  }
  async addOrder(email: string, id: string) {
    return await this.userModel.updateOne(
      { "private.email": email },
      { $push: { order: { goodId: id } } },
    );
  }
  async subBasket(email: string, id: string) {
    return this.updateGoodToBasket(email, id, "sub");
  }
  async deleteBasket(email: string, id: string) {
    return this.deleteGood(email, id, "basket");
  }
}
