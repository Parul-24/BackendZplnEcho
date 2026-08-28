export class WaveDictionaryClass {
    private dict: { [key: number]: any[] } = {};

    addItem(key: number, item: any): void {
        if (!this.dict[key]) {
            this.dict[key] = []; // Initialize the array if it doesn't exist
        }
        this.dict[key].push(item); // Add the item to the array
    }

    removeItem(key: number, item: any): boolean {
        if (!this.dict[key]) {
            return false; // Key does not exist
        }

        const index = this.dict[key].indexOf(item);
        if (index === -1) {
            return false; // Item not found in the array
        }

        this.dict[key].splice(index, 1); // Remove the item from the array
        return true;
    }

    getDictionary(): { [key: string]: any[] } {
        return this.dict;
    }

    getTotalItemCountAcross(): number {
        let totalCount = 0;
        for (const key in this.dict) {
            if (this.dict.hasOwnProperty(key)) {
                totalCount += this.dict[key].length;
            }
        }
        return totalCount;
    }

    getTotalItemCountForSector(sector: WaveSector): number {
        let totalCount = 0;
        const start = sector.getStart()
        const end = sector.getEnd()
        for (let i = start; i <= end; i++) {
            totalCount += this.getItemCountForKey(i);
        }
        return totalCount;
    }

    getTotalItemForSector(sector: WaveSector): string[] {
        let itemArr: any[] = [];
        const start = sector.getStart()
        const end = sector.getEnd()
        for (let i = start; i <= end; i++) {
            Array.prototype.push.apply(itemArr, this.dict[i]);
        }
        return itemArr;
    }

    getTotalItemCount(): number {
    return Object.keys(this.dict).length;
    }


    getItemCountForKey(key: number): number {
        if (this.dict[key]) {
            return this.dict[key].length;
        }
        return 0; // Key does not exist
    }
}


export class WaveSector {
    private start: number;
    private end: number;

    constructor(start: number, end: number) {
        this.start = start;
        this.end = end;
    }

    getStart(): number {
        return this.start;
    }

    getEnd(): number {
        return this.end;
    }

    getLength(): number {
        return this.end - this.start;
    }
}