import {AfterViewInit, Component, EventEmitter, HostListener, Output, ViewChild, ViewContainerRef} from '@angular/core'

@Component({
  selector: 'app-scrollable-area',
  templateUrl: './scrollable-area.component.html',
  styleUrls: ['./scrollable-area.component.css']
})
export class ScrollableAreaComponent implements  AfterViewInit {

  private scrollX = 0

  @Output() offset = new EventEmitter<number>()

  @ViewChild('viewport', {read: ViewContainerRef, static: true})
  private viewport: ViewContainerRef

  constructor(private scroll: ViewContainerRef) {}

  ngAfterViewInit() {
    this.scroll.element.nativeElement.scrollLeft = this.scroll.element.nativeElement.scrollWidth / 4
    new ResizeObserver(() => { this.onScrolled() }).observe(this.scroll.element.nativeElement)
  }

  @HostListener('scroll')
  private onScrolled() {
    const x = this.scroll.element.nativeElement.scrollWidth / 4 - this.scroll.element.nativeElement.scrollLeft

    if (Math.abs(x) >= 1) {
      this.scrollX += x
      this.offset.emit(-this.scrollX)
    }

    this.updateElements()

    this.scroll.element.nativeElement.scrollLeft = this.scroll.element.nativeElement.scrollWidth / 4
  }

  scrollTo(x: number) {
    this.scrollX = x
    this.offset.emit(-this.scrollX)
    this.updateElements()
  }

  private updateElements() {
    this.viewport.element.nativeElement.childNodes.forEach(element => {
      if (element instanceof HTMLElement) {
        element.style.transform = `translateX(${this.scrollX}px)`
      }
    })
  }
}
