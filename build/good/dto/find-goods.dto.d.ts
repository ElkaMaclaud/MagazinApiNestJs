export interface GoodDto {
    image: string[];
    price: number;
    oldPrice?: number;
    name: string;
    brand: string;
    description: string;
    category: string;
    characteristics: {
        name: string;
        value: string;
    } | string;
    sale?: boolean;
    discount?: boolean;
}
export declare class GoodIdsDto {
    ids: string[];
}
