// https://github.com/dsherret/ts-ast-viewer/blob/main/src/utils/createLineNumberAndColumns.ts
export interface LineNumberAndColumn {
    pos: number;
    number: number;
    length: number;
}

function createLineNumberAndColumns(text: string) {
    const lineInfos: LineNumberAndColumn[] = [];
    let lastPos = 0;

    for (let i = 0; i < text.length; i++) {
        if (text[i] === "\n") {
            pushLineInfo(i);
        }
    }

    pushLineInfo(text.length);

    return lineInfos;

    function pushLineInfo(pos: number) {
        lineInfos.push({
            pos: lastPos,
            length: pos - lastPos,
            number: lineInfos.length + 1,
        });
        lastPos = pos + 1;
    }
}

export function getNumberAndColumnFromPos(text: string, pos: number) {
    const lineInfos = createLineNumberAndColumns(text);
    if (pos < 0) {
        return { lineNumber: 1, column: 1 };
    }

    const index = binarySearch(lineInfos, info => {
        if (pos < info.pos) {
            return -1;
        }
        if (pos >= info.pos && pos < info.pos + info.length + 1) { // `+ 1` is for newline char
            return 0;
        }
        return 1;
    });
    const lineInfo = index >= 0 ? lineInfos[index] : lineInfos[lineInfos.length - 1];

    if (lineInfo == null) {
        return { lineNumber: 1, column: 1 };
    }

    return { lineNumber: lineInfo.number, column: Math.min(pos - lineInfo.pos + 1, lineInfo.length + 1) };
}

function binarySearch<T>(
    items: ReadonlyArray<T>,
    compareTo: (value: T) => number,
  ) {
    let top = items.length - 1;
    let bottom = 0;

    while (bottom <= top) {
      const mid = Math.floor((top + bottom) / 2);
      const comparisonResult = compareTo(items[mid]);
      if (comparisonResult === 0) {
        return mid;
      } else if (comparisonResult < 0) {
        top = mid - 1;
      } else {
        bottom = mid + 1;
      }
    }

    return -1;
  }
