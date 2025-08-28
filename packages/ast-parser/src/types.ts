import { FunctionLikeDeclaration, ArrowFunction, FunctionExpression } from "typescript";

export type Functionish = FunctionLikeDeclaration | ArrowFunction | FunctionExpression;
