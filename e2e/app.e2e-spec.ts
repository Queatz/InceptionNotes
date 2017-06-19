import { InceptionTodoPage } from './app.po';

describe('inception-todo App', () => {
  let page: InceptionTodoPage;

  beforeEach(() => {
    page = new InceptionTodoPage();
  });

  it('should display welcome message', () => {
    page.navigateTo();
    expect(page.getParagraphText()).toEqual('Welcome to app!!');
  });
});
