import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
} from "@nestjs/common";
import { UserService } from "./user.service";
import { UserDto } from "./dto/user.dto";
import { AuthDto } from "./dto/auth.dto";
import { ACCES_TOKEN_VERIFY_ERROR, ALREADY_REGISTERED_ERROR } from "./user.constant";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";


@Controller("user")
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async authMiddleware(req: Request) {
    const accessToken = req.headers["authorization"].split(" ")[1];
    if (accessToken) {
      try {
        const decodedToken = this.jwtService.verify(
          accessToken,
          this.configService.get("JWT_SECRET"),
        );
        const userEmail = decodedToken.email;
        return userEmail;
      } catch (error) {
        throw new BadRequestException(ACCES_TOKEN_VERIFY_ERROR, error);
      }
    } else {
      throw new BadRequestException("Отсутствует токен доступа");
    }
  }

  @Post("auth/register")
  async register(@Body() dto: AuthDto) {
    const user = await this.userService.findUser(dto.email);
    if (user) {
      throw new BadRequestException(ALREADY_REGISTERED_ERROR);
    }
    return this.userService.registerUser(dto);
  }

  @HttpCode(200)
  @Post("auth/login")
  async login(@Body() { email: login, password }: AuthDto) {
    const { email } = await this.userService.validateUser(login, password);
    return this.userService.login(email);
  }

  // @UseGuards(JwtAuthGuard)
  @Get("basket")
  async getBasket(@Req() req) {
    const email = await this.authMiddleware(req);
    return this.userService.getBasket(email);
  }

  @Get("favorites")
  async getFavorites(@Req() req) {
    const email = await this.authMiddleware(req);
    return this.userService.getFavorites(email);
  }

  @Get("orders")
  async getOrders(@Req() req) {
    const email = await this.authMiddleware(req);
    return this.userService.getOrders(email);
  }

  @Patch("ChooseAll")
  async ChooseAll(@Req() req, @Body() dto: { on: boolean }) {
    const email = await this.authMiddleware(req);
    return this.userService.ChooseAll(email, dto.on);
  }

  @Get("userData")
  async getUserData(id: string) {
    return this.userService.getUserData(id);
  }

  @Patch("updateUserData")
  async updateUserData(@Body() dto: UserDto, id: string) {
    const result = this.userService.updateUserData(dto, id);
    return result;
  }

  @Patch("deleteSelected")
  async deleteSelected(@Req() req) {
    const email = await this.authMiddleware(req);
    const result = this.userService.deleteSelected(email);
    return result;
  }

  @Patch("addBasket/:id")
  async addBasket(@Req() req, @Param("id") id: string) {
    const email = await this.authMiddleware(req);
    return this.userService.addBasket(email, id);
  }

  @Patch("toggleChoice/:id")
  async toggleChoice(@Req() req, @Param("id") id: string) {
    const email = await this.authMiddleware(req);
    return this.userService.toggleChoice(email, id);
  }

  @Patch("toggleFavorites/:id")
  async addFavorites(@Req() req, @Param("id") id: string) {
    const email = await this.authMiddleware(req);
    return this.userService.toggleFavorites(email, id);
  }

  @Patch("buy/:id")
  async addOrder(@Req() req, @Param("id") id: string) {
    const email = await this.authMiddleware(req);
    return this.userService.addOrder(email, id);
  }

  // @Patch("buy")
  // async buy(@Body() dto: IUserGood) {}

  @Patch("subBasket/:id")
  async subBasket(@Req() req, @Param("id") id: string) {
    const email = await this.authMiddleware(req);
    return this.userService.subBasket(email, id);
  }

  @Patch("deleteBasket/:id")
  async deleteBasket(@Req() req, @Param("id") id: string) {
    const email = await this.authMiddleware(req);
    const result = this.userService.deleteBasket(email, id);
    return result;
  }
}
